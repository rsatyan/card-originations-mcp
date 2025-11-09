import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { applications } from "./submitApplication";

export function makeDecisionTool(agent: PaidMcpAgent<Env, any, any>) {
	const server = agent.server;
	// @ts-ignore
	server.tool(
		"makeDecision",
		"Make a final approval or denial decision on a credit card application based on risk assessment. If approved, determines credit limit, APR, and other terms.",
		{
			applicationId: z.string().describe("The application ID to make a decision on"),
			overrideDecision: z.enum(["approve", "deny", "auto"]).optional().describe("Override automatic decision (default: auto)"),
			manualReviewNotes: z.string().optional().describe("Notes from manual review if applicable"),
		},
		async ({ applicationId, overrideDecision = "auto", manualReviewNotes }: { applicationId: string; overrideDecision?: string; manualReviewNotes?: string }) => {
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

			if (!application.riskAssessed) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "Risk assessment must be completed before making a decision",
								applicationId,
								currentStatus: application.status,
							}, null, 2),
						},
					],
				};
			}

			const riskScore = application.riskAssessment.riskScore;
			const creditScore = application.creditCheck.creditScore;
			const annualIncome = application.income.annual;

			// Determine automatic decision
			let autoDecision: "approved" | "denied";
			if (riskScore >= 60) {
				autoDecision = "approved";
			} else if (riskScore >= 40) {
				// Manual review zone - default to approval if override is auto
				autoDecision = "approved";
			} else {
				autoDecision = "denied";
			}

			// Apply override if provided
			const finalDecision = overrideDecision === "auto"
				? autoDecision
				: overrideDecision === "approve"
					? "approved"
					: "denied";

			let cardTerms = null;

			if (finalDecision === "approved") {
				// Calculate credit limit based on income and credit score
				let baseCreditLimit = Math.min(annualIncome * 0.2, 50000); // Max 20% of income or $50k

				// Adjust based on credit score
				if (creditScore >= 800) {
					baseCreditLimit *= 1.5;
				} else if (creditScore >= 740) {
					baseCreditLimit *= 1.2;
				} else if (creditScore >= 670) {
					baseCreditLimit *= 1.0;
				} else if (creditScore >= 580) {
					baseCreditLimit *= 0.6;
				} else {
					baseCreditLimit *= 0.4;
				}

				// Adjust based on risk score
				baseCreditLimit *= (riskScore / 100);

				const creditLimit = Math.round(baseCreditLimit / 500) * 500; // Round to nearest $500

				// Calculate APR based on credit score and risk
				let apr = 29.99; // Maximum APR
				if (creditScore >= 800) {
					apr = 14.99;
				} else if (creditScore >= 740) {
					apr = 17.99;
				} else if (creditScore >= 670) {
					apr = 21.99;
				} else if (creditScore >= 580) {
					apr = 25.99;
				}

				// Adjust APR based on risk score
				if (riskScore < 70) {
					apr += 2;
				}

				// Determine card tier
				let cardTier: string;
				let annualFee: number;
				let rewardsRate: number;

				if (creditScore >= 740 && creditLimit >= 10000) {
					cardTier = "Premium";
					annualFee = 95;
					rewardsRate = 2.0; // 2% cashback
				} else if (creditScore >= 670 && creditLimit >= 5000) {
					cardTier = "Standard Plus";
					annualFee = 0;
					rewardsRate = 1.5; // 1.5% cashback
				} else {
					cardTier = "Standard";
					annualFee = 0;
					rewardsRate = 1.0; // 1% cashback
				}

				cardTerms = {
					creditLimit,
					apr: Math.round(apr * 100) / 100,
					cardTier,
					annualFee,
					rewardsRate,
					gracePeriod: 25, // days
					lateFee: 39,
					foreignTransactionFee: 3.0, // percentage
				};

				application.status = "approved";
			} else {
				application.status = "denied";
			}

			application.decision = {
				decision: finalDecision,
				decidedAt: new Date().toISOString(),
				autoDecision,
				overridden: overrideDecision !== "auto",
				manualReviewNotes,
				cardTerms,
				denialReasons: finalDecision === "denied" ? getDenialReasons(application) : null,
			};

			applications.set(applicationId, application);

			const response: any = {
				success: true,
				applicationId,
				decision: finalDecision,
				status: application.status,
			};

			if (finalDecision === "approved") {
				response.cardTerms = cardTerms;
				response.message = "Application approved! Card terms have been determined. Next step: Card activation.";
			} else {
				response.denialReasons = application.decision.denialReasons;
				response.message = "Application denied based on risk assessment and credit evaluation.";
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		}
	);
}

function getDenialReasons(application: any): string[] {
	const reasons = [];

	if (application.creditCheck.creditScore < 580) {
		reasons.push("Credit score below minimum threshold");
	}

	if (application.riskAssessment.riskScore < 40) {
		reasons.push("High risk assessment score");
	}

	if (application.creditCheck.history.delinquencies > 2) {
		reasons.push("Multiple recent delinquencies");
	}

	if (application.creditCheck.history.publicRecords > 0) {
		reasons.push("Public records (bankruptcy, liens, etc.)");
	}

	if (application.riskAssessment.debtToIncomeRatio > 0.5) {
		reasons.push("Debt-to-income ratio too high");
	}

	if (application.employment.status === "unemployed") {
		reasons.push("Insufficient income verification");
	}

	if (reasons.length === 0) {
		reasons.push("Does not meet underwriting criteria");
	}

	return reasons;
}
