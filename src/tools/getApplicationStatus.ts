import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { applications } from "./submitApplication";

export function getApplicationStatusTool(agent: PaidMcpAgent<Env, any, any>) {
	const server = agent.server;
	// @ts-ignore
	server.tool(
		"getApplicationStatus",
		"Get the current status and details of a credit card application. Returns comprehensive information about the application progress.",
		{
			applicationId: z.string().describe("The application ID to check status for"),
			includeFullDetails: z.boolean().optional().describe("Include all details (default: false, returns summary only)"),
		},
		async ({ applicationId, includeFullDetails = false }: { applicationId: string; includeFullDetails?: boolean }) => {
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

			// Build summary response
			const summary: any = {
				success: true,
				applicationId,
				applicantName: `${application.firstName} ${application.lastName}`,
				status: application.status,
				submittedAt: application.submittedAt,
				progress: {
					submitted: true,
					identityVerified: application.identityVerified,
					creditChecked: application.creditChecked,
					riskAssessed: application.riskAssessed,
					decisionMade: !!application.decision,
					cardActivated: application.cardActivated,
				},
			};

			// Add next step recommendation
			if (!application.identityVerified) {
				summary.nextStep = "Identity verification required";
			} else if (!application.creditChecked) {
				summary.nextStep = "Credit check required";
			} else if (!application.riskAssessed) {
				summary.nextStep = "Risk assessment required";
			} else if (!application.decision) {
				summary.nextStep = "Decision pending";
			} else if (application.status === "approved" && !application.cardActivated) {
				summary.nextStep = "Card activation available";
			} else if (application.status === "active") {
				summary.nextStep = "Application complete - card active";
			} else if (application.status === "denied") {
				summary.nextStep = "Application denied";
			} else {
				summary.nextStep = "Unknown";
			}

			// Add decision details if available
			if (application.decision) {
				summary.decision = {
					decision: application.decision.decision,
					decidedAt: application.decision.decidedAt,
				};

				if (application.decision.decision === "approved") {
					summary.cardTerms = application.decision.cardTerms;
				} else {
					summary.denialReasons = application.decision.denialReasons;
				}
			}

			// Add card details if activated
			if (application.cardActivated && application.cardDetails) {
				summary.cardDetails = {
					maskedCardNumber: application.cardDetails.maskedCardNumber,
					cardholderName: application.cardDetails.cardholderName,
					expirationDate: `${application.cardDetails.expirationMonth}/${application.cardDetails.expirationYear}`,
					cardTier: application.cardDetails.cardTier,
					status: application.cardDetails.status,
				};

				summary.accountDetails = {
					accountNumber: application.accountDetails.accountNumber,
					creditLimit: application.accountDetails.creditLimit,
					availableCredit: application.accountDetails.availableCredit,
					currentBalance: application.accountDetails.currentBalance,
					apr: application.accountDetails.apr,
				};
			}

			// If full details requested, include everything
			if (includeFullDetails) {
				const fullDetails: any = {
					...summary,
					applicantDetails: {
						firstName: application.firstName,
						lastName: application.lastName,
						email: application.email,
						phone: application.phone,
						dateOfBirth: application.dateOfBirth,
						address: application.address,
					},
					employment: application.employment,
					income: application.income,
					housing: application.housing,
				};

				if (application.identityVerification) {
					fullDetails.identityVerification = {
						verified: application.identityVerification.verified,
						verificationScore: application.identityVerification.verificationScore,
						verifiedAt: application.identityVerification.verifiedAt,
						checks: application.identityVerification.checks,
					};
				}

				if (application.creditCheck) {
					fullDetails.creditCheck = {
						creditScore: application.creditCheck.creditScore,
						scoreRange: application.creditCheck.scoreRange,
						utilizationRate: application.creditCheck.utilizationRate,
						riskFactors: application.creditCheck.riskFactors,
						checkedAt: application.creditCheck.checkedAt,
					};
				}

				if (application.riskAssessment) {
					fullDetails.riskAssessment = {
						riskScore: application.riskAssessment.riskScore,
						riskCategory: application.riskAssessment.riskCategory,
						recommendation: application.riskAssessment.recommendation,
						debtToIncomeRatio: application.riskAssessment.debtToIncomeRatio,
						assessedAt: application.riskAssessment.assessedAt,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(fullDetails, null, 2),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(summary, null, 2),
					},
				],
			};
		}
	);
}
