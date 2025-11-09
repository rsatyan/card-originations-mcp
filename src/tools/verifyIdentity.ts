import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { applications } from "./submitApplication";

export function verifyIdentityTool(agent: PaidMcpAgent<Env, any, any>) {
	const server = agent.server;
	// @ts-ignore
	server.tool(
		"verifyIdentity",
		"Verify the identity of an applicant for a credit card application. This checks government-issued ID, SSN, and performs KYC checks.",
		{
			applicationId: z.string().describe("The application ID to verify"),
			governmentIdType: z.enum(["drivers_license", "passport", "state_id"]).describe("Type of government-issued ID"),
			governmentIdNumber: z.string().describe("Government ID number"),
			verificationMethod: z.enum(["automatic", "manual", "document_upload"]).describe("Method of verification"),
		},
		async ({ applicationId, governmentIdType, governmentIdNumber, verificationMethod }: { applicationId: string; governmentIdType: string; governmentIdNumber: string; verificationMethod: string }) => {
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

			if (application.status !== "submitted") {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: `Cannot verify identity. Application status is '${application.status}'`,
								applicationId,
							}, null, 2),
						},
					],
				};
			}

			// Simulate identity verification
			// In production, this would integrate with services like Stripe Identity, Onfido, or Jumio
			const verificationScore = Math.random() * 100;
			const verified = verificationScore > 30; // 70% pass rate

			application.identityVerification = {
				verified,
				verificationScore,
				governmentIdType,
				verificationMethod,
				verifiedAt: new Date().toISOString(),
				checks: {
					documentAuthenticity: verificationScore > 40,
					faceMatch: verificationScore > 35,
					ssnMatch: verificationScore > 30,
					addressVerification: verificationScore > 25,
				},
			};

			if (verified) {
				application.status = "identity_verified";
				application.identityVerified = true;
			} else {
				application.status = "identity_verification_failed";
			}

			applications.set(applicationId, application);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							applicationId,
							verified,
							verificationScore: Math.round(verificationScore),
							status: application.status,
							message: verified
								? "Identity verified successfully. Next step: Credit check."
								: "Identity verification failed. Application cannot proceed.",
							checks: application.identityVerification.checks,
						}, null, 2),
					},
				],
			};
		}
	);
}
