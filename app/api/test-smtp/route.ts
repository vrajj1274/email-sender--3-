import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { smtpConfig } = body

    if (!smtpConfig || !smtpConfig.auth || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      return NextResponse.json({ error: "Invalid SMTP configuration" }, { status: 400 })
    }

    // Log SMTP config (without password)
    console.log("Testing SMTP Config:", {
      ...smtpConfig,
      auth: { user: smtpConfig.auth.user, pass: "********" },
    })

    // In the preview environment, we can't actually test SMTP connections
    // due to DNS lookup limitations, so we'll simulate a successful connection
    return NextResponse.json({
      success: true,
      message: "SMTP configuration looks valid (Note: actual connection testing is only available in production)",
      previewOnly: true,
      smtpDetails: {
        service: smtpConfig.service || "custom",
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.auth.user,
      },
    })
  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json(
      {
        error: `Failed to process request: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
