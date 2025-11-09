import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { applications } from "./submitApplication";

export function checkCreditTool(agent: PaidMcpAgent<Env, any, any>) {
	const server = agent.server;
	// @ts-ignore
	server.tool(
		"checkCredit",
		"Run a credit check on an applicant. This pulls credit score, credit history, and generates a credit report summary.",
		{
			applicationId: z.string().describe("The application ID to check credit for"),
			bureaus: z.array(z.enum(["experian", "equifax", "transunion"])).optional().describe("Credit bureaus to check (defaults to all three)"),
		},
		async ({ applicationId, bureaus = ["experian", "equifax", "transunion"] }: { applicationId: string; bureaus?: string[] }) => {
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

			if (!application.identityVerified) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: "Identity must be verified before running credit check",
								applicationId,
								currentStatus: application.status,
							}, null, 2),
						},
					],
				};
			}

			// Simulate credit check
			// In production, this would integrate with credit bureaus (Experian, Equifax, TransUnion)
			const creditScore = Math.floor(Math.random() * (850 - 300) + 300); // FICO score range
			const creditHistory = {
				accountsOpen: Math.floor(Math.random() * 15) + 1,
				accountsClosed: Math.floor(Math.random() * 10),
				totalCreditLimit: Math.floor(Math.random() * 100000) + 10000,
				totalBalance: Math.floor(Math.random() * 50000),
				oldestAccount: Math.floor(Math.random() * 20) + 1, // years
				averageAccountAge: Math.floor(Math.random() * 10) + 1, // years
				hardInquiries: Math.floor(Math.random() * 5),
				delinquencies: Math.floor(Math.random() * 3),
				publicRecords: Math.floor(Math.random() * 2),
			};

			const utilizationRate = (creditHistory.totalBalance / creditHistory.totalCreditLimit) * 100;

			application.creditCheck = {
				creditScore,
				scoreRange: getCreditScoreRange(creditScore),
				bureaus,
				checkedAt: new Date().toISOString(),
				history: creditHistory,
				utilizationRate: Math.round(utilizationRate * 100) / 100,
				riskFactors: [],
			};

			// Identify risk factors
			if (creditScore < 600) application.creditCheck.riskFactors.push("Low credit score");
			if (utilizationRate > 70) application.creditCheck.riskFactors.push("High credit utilization");
			if (creditHistory.delinquencies > 0) application.creditCheck.riskFactors.push("Recent delinquencies");
			if (creditHistory.hardInquiries > 3) application.creditCheck.riskFactors.push("Multiple recent inquiries");
			if (creditHistory.publicRecords > 0) application.creditCheck.riskFactors.push("Public records found");
			if (creditHistory.averageAccountAge < 2) application.creditCheck.riskFactors.push("Limited credit history");

			application.status = "credit_checked";
			application.creditChecked = true;

			applications.set(applicationId, application);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							applicationId,
							creditScore,
							scoreRange: application.creditCheck.scoreRange,
							utilizationRate: application.creditCheck.utilizationRate,
							creditHistory,
							riskFactors: application.creditCheck.riskFactors,
							status: application.status,
							message: "Credit check completed successfully. Next step: Risk assessment.",
						}, null, 2),
					},
				],
			};
		}
	);
}

function getCreditScoreRange(score: number): string {
	if (score >= 800) return "Exceptional";
	if (score >= 740) return "Very Good";
	if (score >= 670) return "Good";
	if (score >= 580) return "Fair";
	return "Poor";
}
