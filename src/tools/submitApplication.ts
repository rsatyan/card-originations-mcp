import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";

// In-memory storage for applications (in production, use a database)
const applications = new Map<string, any>();

export function submitApplicationTool(agent: PaidMcpAgent<Env, any, any>) {
	const server = agent.server;
	// @ts-ignore
	server.tool(
		"submitApplication",
		"Submit a new credit card application with applicant details. This is the first step in the card originations process.",
		{
			firstName: z.string().describe("Applicant's first name"),
			lastName: z.string().describe("Applicant's last name"),
			email: z.string().email().describe("Applicant's email address"),
			phone: z.string().describe("Applicant's phone number"),
			dateOfBirth: z.string().describe("Date of birth (YYYY-MM-DD)"),
			ssn: z.string().describe("Social Security Number (last 4 digits)"),
			address: z.object({
				street: z.string(),
				city: z.string(),
				state: z.string(),
				zipCode: z.string(),
			}).describe("Residential address"),
			employment: z.object({
				status: z.enum(["employed", "self-employed", "unemployed", "retired"]),
				employer: z.string().optional(),
				jobTitle: z.string().optional(),
				yearsEmployed: z.number().optional(),
			}).describe("Employment information"),
			income: z.object({
				annual: z.number().describe("Annual income in dollars"),
				source: z.enum(["salary", "business", "investments", "retirement", "other"]),
			}).describe("Income information"),
			housing: z.object({
				status: z.enum(["own", "rent", "other"]),
				monthlyPayment: z.number().describe("Monthly housing payment"),
			}).describe("Housing information"),
		},
		async (params: any) => {
			const applicationId = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			const application = {
				applicationId,
				...params,
				status: "submitted",
				submittedAt: new Date().toISOString(),
				identityVerified: false,
				creditChecked: false,
				riskAssessed: false,
				decision: null,
				cardActivated: false,
			};

			applications.set(applicationId, application);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							applicationId,
							status: "submitted",
							message: "Application submitted successfully. Next step: Identity verification.",
							submittedAt: application.submittedAt,
						}, null, 2),
					},
				],
			};
		}
	);
}

export { applications };
