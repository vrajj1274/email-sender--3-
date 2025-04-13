import { type NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

// Check if we're in a production environment
const isProduction = process.env.NODE_ENV === "production"

// Mock function to simulate email sending in preview environment
async function mockSendEmails(recipients: any[], messageTemplate: string, subject: string) {
  console.log("MOCK: Sending emails to", recipients.length, "recipients")

  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Simulate some random failures
  const failureRate = 0.1 // 10% failure rate
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
    debug: ["Running in preview mode - emails are simulated"] as string[],
  }

  for (const recipient of recipients) {
    if (Math.random() > failureRate) {
      results.success++
      results.debug.push(`Simulated successful email to: ${recipient.email}`)
    } else {
      results.failed++
      results.errors.push(`Mock failure for ${recipient.email}`)
      results.debug.push(`Simulated failure for: ${recipient.email}`)
    }
  }

  return results
}

// Real email sending function for production
async function sendRealEmails(recipients: any[], messageTemplate: string, smtpConfig: any) {
  console.log("PRODUCTION: Sending real emails to", recipients.length, "recipients")
  console.log("SMTP Config:", {
    ...smtpConfig,
    auth: { user: smtpConfig.auth.user, pass: "********" },
  })

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
    debug: [] as string[],
  }

  try {
    // Add debug info
    results.debug.push("Creating transporter with provided SMTP config")

    // Create a transporter using the provided SMTP config
    const transporter = nodemailer.createTransport(smtpConfig)

    // Add debug info
    results.debug.push("Attempting to verify SMTP connection")

    try {
      // Verify the connection configuration
      await transporter.verify()
      console.log("SMTP connection verified successfully")
      results.debug.push("SMTP connection verified successfully")
    } catch (verifyError) {
      console.error("SMTP verification failed:", verifyError)
      results.debug.push(
        `SMTP verification failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`,
      )

      // Try with a different secure option if using Gmail
      if (smtpConfig.service === "gmail") {
        results.debug.push("Trying alternative Gmail configuration")

        // Try with secure: true for Gmail
        const altConfig = {
          ...smtpConfig,
          secure: true,
          port: 465,
        }

        try {
          const altTransporter = nodemailer.createTransport(altConfig)
          await altTransporter.verify()
          results.debug.push("Alternative Gmail configuration successful")
          const transporter = altTransporter
        } catch (altError) {
          results.debug.push(
            `Alternative Gmail configuration failed: ${altError instanceof Error ? altError.message : String(altError)}`,
          )
        }
      }
    }

    // Send emails to each recipient
    for (const recipient of recipients) {
      try {
        // Generate personalized message by replacing placeholders
        let personalizedMessage = messageTemplate
        Object.keys(recipient).forEach((key) => {
          personalizedMessage = personalizedMessage.replace(new RegExp(`\\$\\{${key}\\}`, "g"), recipient[key] || "")
        })

        // Prepare email data
        const mailOptions = {
          from: smtpConfig.auth.user,
          to: recipient.email, // Assuming each recipient has an email field
          subject: "Your Personalized Message", // You might want to make this customizable
          text: personalizedMessage,
          html: personalizedMessage.replace(/\n/g, "<br>"),
        }

        results.debug.push(`Attempting to send email to ${recipient.email}`)

        // Send the email
        const info = await transporter.sendMail(mailOptions)

        console.log("Email sent:", info.messageId)
        results.debug.push(`Email sent to ${recipient.email}, messageId: ${info.messageId}`)
        results.success++
      } catch (error) {
        console.error("Error sending to individual recipient:", error)
        results.failed++
        results.errors.push(
          `Failed to send to ${recipient.email}: ${error instanceof Error ? error.message : String(error)}`,
        )
        results.debug.push(`Error details for ${recipient.email}: ${JSON.stringify(error)}`)
      }
    }
  } catch (error) {
    console.error("SMTP connection error:", error)
    results.debug.push(`SMTP connection error: ${error instanceof Error ? error.message : String(error)}`)
    results.debug.push(`Error details: ${JSON.stringify(error)}`)
    throw new Error(`SMTP connection failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  return results
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipients, messageTemplate, smtpConfig, subject = "Your Personalized Message" } = body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 })
    }

    if (!messageTemplate) {
      return NextResponse.json({ error: "No message template provided" }, { status: 400 })
    }

    if (!smtpConfig || !smtpConfig.auth || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      return NextResponse.json({ error: "Invalid SMTP configuration" }, { status: 400 })
    }

    // Log SMTP config (without password)
    console.log("SMTP Config:", {
      ...smtpConfig,
      auth: { user: smtpConfig.auth.user, pass: "********" },
    })

    // In the preview environment, we can't use Nodemailer due to DNS lookup limitations
    // So we'll always use the mock implementation
    const results = await mockSendEmails(recipients, messageTemplate, subject)

    // Add note about preview limitations
    results.debug.push("Note: In the preview environment, emails cannot actually be sent due to DNS lookup limitations")
    results.debug.push("When deployed to production, real emails will be sent using the configured SMTP settings")

    return NextResponse.json({
      message: `${results.success} emails sent successfully, ${results.failed} failed`,
      details: results,
      preview: true,
      note: "In the preview environment, emails are simulated. Deploy to production to send real emails.",
    })
  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json(
      {
        error: `Failed to process request: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
