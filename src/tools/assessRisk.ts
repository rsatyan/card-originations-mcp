import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { applications } from "./submitApplication";

export function assessRiskTool(agent: PaidMcpAgent<Env, any, any>) {
	const server = agent.server;
	// @ts-ignore
	server.tool(
		"assessRisk",
		"Perform a comprehensive risk assessment on a credit card application based on credit check, income, employment, and other factors.",
		{
			applicationId: z.string().describe("The application ID to assess risk for"),
		},
		async ({ applicationId }: { applicationId: string }) => {
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

			if (!application.creditChecked) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "Credit check must be completed before risk assessment",
								applicationId,
								currentStatus: application.status,
							}, null, 2),
						},
					],
				};
			}

			// Calculate risk score based on multiple factors
			let riskScore = 100; // Start at 100 (best score)
			const riskFactors = [];

			// Credit score impact (40% weight)
			const creditScore = application.creditCheck.creditScore;
			if (creditScore < 580) {
				riskScore -= 40;
				riskFactors.push({ factor: "Poor credit score", impact: -40 });
			} else if (creditScore < 670) {
				riskScore -= 25;
				riskFactors.push({ factor: "Fair credit score", impact: -25 });
			} else if (creditScore < 740) {
				riskScore -= 10;
				riskFactors.push({ factor: "Good credit score", impact: -10 });
			} else if (creditScore >= 800) {
				riskScore += 5;
				riskFactors.push({ factor: "Exceptional credit score", impact: +5 });
			}

			// Income to debt ratio (20% weight)
			const annualIncome = application.income.annual;
			const monthlyIncome = annualIncome / 12;
			const debtToIncomeRatio = (application.creditCheck.history.totalBalance / monthlyIncome);

			if (debtToIncomeRatio > 0.5) {
				riskScore -= 20;
				riskFactors.push({ factor: "High debt-to-income ratio", impact: -20 });
			} else if (debtToIncomeRatio > 0.35) {
				riskScore -= 10;
				riskFactors.push({ factor: "Moderate debt-to-income ratio", impact: -10 });
			}

			// Credit utilization (15% weight)
			const utilization = application.creditCheck.utilizationRate;
			if (utilization > 70) {
				riskScore -= 15;
				riskFactors.push({ factor: "High credit utilization", impact: -15 });
			} else if (utilization > 50) {
				riskScore -= 8;
				riskFactors.push({ factor: "Moderate credit utilization", impact: -8 });
			}

			// Employment stability (10% weight)
			if (application.employment.status === "unemployed") {
				riskScore -= 10;
				riskFactors.push({ factor: "Unemployed", impact: -10 });
			} else if (application.employment.yearsEmployed && application.employment.yearsEmployed < 1) {
				riskScore -= 5;
				riskFactors.push({ factor: "Short employment history", impact: -5 });
			} else if (application.employment.yearsEmployed && application.employment.yearsEmployed > 5) {
				riskScore += 3;
				riskFactors.push({ factor: "Stable employment", impact: +3 });
			}

			// Delinquencies (10% weight)
			const delinquencies = application.creditCheck.history.delinquencies;
			if (delinquencies > 0) {
				const impact = delinquencies * -5;
				riskScore += impact;
				riskFactors.push({ factor: `${delinquencies} delinquency/ies`, impact });
			}

			// Public records (5% weight)
			const publicRecords = application.creditCheck.history.publicRecords;
			if (publicRecords > 0) {
				riskScore -= 5;
				riskFactors.push({ factor: "Public records found", impact: -5 });
			}

			// Ensure risk score is within bounds
			riskScore = Math.max(0, Math.min(100, riskScore));

			// Determine risk category
			let riskCategory: string;
			if (riskScore >= 80) riskCategory = "Low Risk";
			else if (riskScore >= 60) riskCategory = "Medium Risk";
			else if (riskScore >= 40) riskCategory = "High Risk";
			else riskCategory = "Very High Risk";

			application.riskAssessment = {
				riskScore,
				riskCategory,
				riskFactors,
				assessedAt: new Date().toISOString(),
				debtToIncomeRatio: Math.round(debtToIncomeRatio * 100) / 100,
				recommendation: riskScore >= 60 ? "Approve" : riskScore >= 40 ? "Manual Review" : "Deny",
			};

			application.status = "risk_assessed";
			application.riskAssessed = true;

			applications.set(applicationId, application);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							applicationId,
							riskScore,
							riskCategory,
							recommendation: application.riskAssessment.recommendation,
							riskFactors,
							debtToIncomeRatio: application.riskAssessment.debtToIncomeRatio,
							status: application.status,
							message: "Risk assessment completed successfully. Next step: Make decision.",
						}, null, 2),
					},
				],
			};
		}
	);
}
