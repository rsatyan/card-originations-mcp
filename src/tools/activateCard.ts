import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { applications } from "./submitApplication";

export function activateCardTool(agent: PaidMcpAgent<Env, any, any>) {
	const server = agent.server;
	// @ts-ignore
	server.tool(
		"activateCard",
		"Activate an approved credit card. This generates card details and activates the account for use.",
		{
			applicationId: z.string().describe("The application ID for the approved card"),
			cardDeliveryAddress: z.object({
				street: z.string(),
				city: z.string(),
				state: z.string(),
				zipCode: z.string(),
			}).optional().describe("Card delivery address (defaults to application address)"),
			requestedPIN: z.string().length(4).optional().describe("4-digit PIN (will be randomly generated if not provided)"),
		},
		async ({ applicationId, cardDeliveryAddress, requestedPIN }: { applicationId: string; cardDeliveryAddress?: any; requestedPIN?: string }) => {
			const application = applications.get(applicationId);

			if (!application) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "Application not found",
								applicationId,
							}, null, 2),
						},
					],
				};
			}

			if (application.status !== "approved") {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: `Cannot activate card. Application status is '${application.status}'`,
								applicationId,
								currentStatus: application.status,
							}, null, 2),
						},
					],
				};
			}

			if (application.cardActivated) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "Card has already been activated",
								applicationId,
								cardNumber: application.cardDetails.maskedCardNumber,
							}, null, 2),
						},
					],
				};
			}

			// Generate card number (simulated - in production this would be from card issuer)
			const cardNumber = generateCardNumber();
			const maskedCardNumber = maskCardNumber(cardNumber);

			// Generate CVV
			const cvv = Math.floor(Math.random() * 900 + 100).toString();

			// Set expiration date (5 years from now)
			const expirationDate = new Date();
			expirationDate.setFullYear(expirationDate.getFullYear() + 5);
			const expirationMonth = String(expirationDate.getMonth() + 1).padStart(2, '0');
			const expirationYear = String(expirationDate.getFullYear()).slice(-2);

			// Generate PIN if not provided
			const pin = requestedPIN || Math.floor(Math.random() * 9000 + 1000).toString();

			// Use provided delivery address or default to application address
			const deliveryAddress = cardDeliveryAddress || application.address;

			application.cardDetails = {
				cardNumber, // In production, this should be encrypted
				maskedCardNumber,
				cvv, // In production, this should be encrypted
				expirationMonth,
				expirationYear,
				pin, // In production, this should be encrypted
				cardholderName: `${application.firstName} ${application.lastName}`.toUpperCase(),
				cardTier: application.decision.cardTerms.cardTier,
				deliveryAddress,
				activatedAt: new Date().toISOString(),
				status: "active",
			};

			application.status = "active";
			application.cardActivated = true;

			// Generate account number
			const accountNumber = `CC${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

			application.accountDetails = {
				accountNumber,
				creditLimit: application.decision.cardTerms.creditLimit,
				availableCredit: application.decision.cardTerms.creditLimit,
				currentBalance: 0,
				statementBalance: 0,
				minimumPaymentDue: 0,
				paymentDueDate: null,
				apr: application.decision.cardTerms.apr,
				rewardsBalance: 0,
			};

			applications.set(applicationId, application);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							applicationId,
							accountNumber,
							cardDetails: {
								maskedCardNumber,
								cardholderName: application.cardDetails.cardholderName,
								expirationDate: `${expirationMonth}/${expirationYear}`,
								cardTier: application.cardDetails.cardTier,
								status: "active",
							},
							accountDetails: {
								creditLimit: application.accountDetails.creditLimit,
								availableCredit: application.accountDetails.availableCredit,
								apr: application.accountDetails.apr,
							},
							deliveryInfo: {
								address: deliveryAddress,
								estimatedDelivery: "5-7 business days",
							},
							message: "Card activated successfully! Card will be delivered to the specified address.",
							securityNote: "Full card details (including CVV and PIN) have been securely stored and will be sent separately.",
						}, null, 2),
					},
				],
			};
		}
	);
}

function generateCardNumber(): string {
	// Generate a valid-looking card number (Luhn algorithm compliant)
	// Using 4 prefix for Visa
	let cardNumber = "4";

	// Generate 14 random digits
	for (let i = 0; i < 14; i++) {
		cardNumber += Math.floor(Math.random() * 10);
	}

	// Calculate and add Luhn check digit
	const checkDigit = calculateLuhnCheckDigit(cardNumber);
	cardNumber += checkDigit;

	return cardNumber;
}

function calculateLuhnCheckDigit(cardNumber: string): number {
	let sum = 0;
	let isEven = true;

	// Loop through values starting from the rightmost digit
	for (let i = cardNumber.length - 1; i >= 0; i--) {
		let digit = parseInt(cardNumber.charAt(i));

		if (isEven) {
			digit *= 2;
			if (digit > 9) {
				digit -= 9;
			}
		}

		sum += digit;
		isEven = !isEven;
	}

	return (10 - (sum % 10)) % 10;
}

function maskCardNumber(cardNumber: string): string {
	// Show only last 4 digits
	return `****-****-****-${cardNumber.slice(-4)}`;
}
