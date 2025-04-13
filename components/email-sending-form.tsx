"use client"

import type React from "react"

import { useState, useRef } from "react"
import * as XLSX from "xlsx"
import { Loader2, Upload, AlertCircle, Info, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function EmailSendingForm() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [excelData, setExcelData] = useState<any[]>([])
  const [allExcelData, setAllExcelData] = useState<any[]>([]) // Store all Excel data
  const [excelColumns, setExcelColumns] = useState<string[]>([])
  const [previewMessages, setPreviewMessages] = useState<string[]>([])
  const [sendingResults, setSendingResults] = useState<any>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState<any>(null)

  // Form state
  const [messageTemplate, setMessageTemplate] = useState("")
  const [senderEmail, setSenderEmail] = useState("")
  const [senderPassword, setSenderPassword] = useState("")
  const [smtpService, setSmtpService] = useState("")
  const [customSmtpHost, setCustomSmtpHost] = useState("")
  const [customSmtpPort, setCustomSmtpPort] = useState("")
  const [customSmtpSecurity, setCustomSmtpSecurity] = useState("tls")
  const [emailSubject, setEmailSubject] = useState("Your Personalized Message")

  // Form validation state
  const [errors, setErrors] = useState<Record<string, string>>({})

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) {
          toast({
            title: "Error",
            description: "The Excel file is empty or has no valid data.",
            variant: "destructive",
          })
          return
        }

        // Check if the data has an email column
        const firstRow = jsonData[0]
        const hasEmailColumn = Object.keys(firstRow).some((key) => key.toLowerCase() === "email")

        if (!hasEmailColumn) {
          toast({
            title: "Error",
            description: "The Excel file must contain an 'email' column.",
            variant: "destructive",
          })
          return
        }

        // Get column names from the first row
        const columns = Object.keys(jsonData[0])
        setExcelColumns(columns)

        // Store all Excel data
        setAllExcelData(jsonData)

        // Store only the first few rows for preview
        setExcelData(jsonData.slice(0, 2))

        // Generate preview messages if template exists
        if (messageTemplate) {
          generatePreviewMessages(messageTemplate, jsonData.slice(0, 2))
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to parse the Excel file. Please make sure it's a valid .xlsx file.",
          variant: "destructive",
        })
      }
    }

    reader.readAsArrayBuffer(file)
  }

  const generatePreviewMessages = (template: string, data: any[]) => {
    const messages = data.map((row) => {
      let message = template
      Object.keys(row).forEach((key) => {
        message = message.replace(new RegExp(`\\$\\{${key}\\}`, "g"), row[key] || "")
      })
      return message
    })
    setPreviewMessages(messages)
  }

  const handleMessageTemplateChange = (value: string) => {
    setMessageTemplate(value)
    if (excelData.length > 0) {
      generatePreviewMessages(value, excelData)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (excelData.length === 0) {
      newErrors.excelFile = "Please upload a valid Excel file with recipient data."
    }

    if (messageTemplate.length < 10) {
      newErrors.messageTemplate = "Message template must be at least 10 characters."
    }

    if (!senderEmail) {
      newErrors.senderEmail = "Sender email is required."
    } else if (!/\S+@\S+\.\S+/.test(senderEmail)) {
      newErrors.senderEmail = "Invalid email address."
    }

    if (!senderPassword) {
      newErrors.senderPassword = "Password is required."
    }

    if (!smtpService) {
      newErrors.smtpService = "Please select an SMTP service."
    }

    if (smtpService === "custom") {
      if (!customSmtpHost) {
        newErrors.customSmtpHost = "SMTP host is required."
      }

      if (!customSmtpPort) {
        newErrors.customSmtpPort = "SMTP port is required."
      }
    }

    if (!emailSubject) {
      newErrors.emailSubject = "Email subject is required."
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getSmtpConfig = () => {
    // Base configuration
    const config: any = {
      auth: {
        user: senderEmail,
        pass: senderPassword,
      },
    }

    // Add service-specific configuration
    switch (smtpService) {
      case "gmail":
        config.service = "gmail"
        // Gmail typically uses port 587 with TLS
        config.port = 587
        config.secure = false
        break
      case "outlook":
        config.service = "outlook"
        break
      case "yahoo":
        config.service = "yahoo"
        break
      case "custom":
        config.host = customSmtpHost
        config.port = Number.parseInt(customSmtpPort, 10)
        config.secure = customSmtpSecurity === "ssl"
        break
      default:
        break
    }

    return config
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: "Error",
        description: "Please fix the form errors before submitting.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setSendingResults(null)
    setDebugInfo([])

    try {
      // Get SMTP configuration
      const smtpConfig = getSmtpConfig()

      // Send the request to the API
      const response = await fetch("/api/send-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: allExcelData,
          messageTemplate,
          smtpConfig,
          subject: emailSubject,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to send emails")
      }

      // Store the results for display
      setSendingResults(result)

      // Store debug info if available
      if (result.details && result.details.debug) {
        setDebugInfo(result.details.debug)
      }

      toast({
        title: "Success",
        description: result.message || `${allExcelData.length} emails have been sent successfully.`,
      })

      // If this was a preview/mock, show additional information
      if (result.preview) {
        toast({
          title: "Preview Mode",
          description:
            result.note || "Note: Emails were simulated in preview mode. In production, real emails will be sent.",
          duration: 6000,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send emails. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const testSmtpConnection = async () => {
    if (!senderEmail || !senderPassword || !smtpService) {
      toast({
        title: "Error",
        description: "Please fill in all SMTP settings before testing.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setSmtpTestResult(null)

    try {
      // Get SMTP configuration
      const smtpConfig = getSmtpConfig()

      // Send a test request
      const response = await fetch("/api/test-smtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          smtpConfig,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to connect to SMTP server")
      }

      // Store the test result
      setSmtpTestResult(result)

      toast({
        title: "Success",
        description: result.message || "SMTP configuration looks valid",
      })

      if (result.previewOnly) {
        toast({
          title: "Preview Limitation",
          description: "Note: Actual SMTP connection testing is only available in production.",
          duration: 6000,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to connect to SMTP server. Please check your settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Preview Environment Limitations</AlertTitle>
        <AlertDescription>
          <p>In this preview environment, emails cannot actually be sent due to technical limitations.</p>
          <p className="mt-2">To send real emails, you need to:</p>
          <ol className="list-decimal pl-5 mt-1 space-y-1">
            <li>Deploy this application to production</li>
            <li>Configure your SMTP settings in the deployed version</li>
          </ol>
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Upload Recipients</CardTitle>
            <CardDescription>
              Upload an Excel file (.xlsx) with recipient information. The file must include an "email" column.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="excelFile">Excel File</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="excelFile"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleExcelUpload}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              {errors.excelFile && <p className="text-sm font-medium text-destructive">{errors.excelFile}</p>}
              <p className="text-sm text-muted-foreground">
                Upload an Excel file with columns for personalization. Must include an "email" column.
              </p>
            </div>

            {excelData.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Preview of uploaded data:</h3>
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {excelColumns.map((column) => (
                          <TableHead key={column}>{column}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {excelData.map((row, index) => (
                        <TableRow key={index}>
                          {excelColumns.map((column) => (
                            <TableCell key={column}>{row[column]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Showing {excelData.length} of {allExcelData.length} rows
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Compose Message</CardTitle>
            <CardDescription>
              Write your message template using placeholders like ${"{"}name{"}"}, ${"{"}email{"}"}, etc. based on your
              Excel columns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailSubject">Email Subject</Label>
                <Input
                  id="emailSubject"
                  placeholder="Your Personalized Message"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
                {errors.emailSubject && <p className="text-sm font-medium text-destructive">{errors.emailSubject}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="messageTemplate">Message Template</Label>
                <Textarea
                  id="messageTemplate"
                  placeholder="Hi ${name}, your account at ${company} is active from ${date}."
                  className="min-h-[150px]"
                  value={messageTemplate}
                  onChange={(e) => handleMessageTemplateChange(e.target.value)}
                />
                {errors.messageTemplate && (
                  <p className="text-sm font-medium text-destructive">{errors.messageTemplate}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Available placeholders: {excelColumns.map((col) => `\${${col}}`).join(", ")}
                </p>
              </div>
            </div>

            {previewMessages.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Message Preview:</h3>
                <Tabs defaultValue="0">
                  <TabsList>
                    {previewMessages.map((_, index) => (
                      <TabsTrigger key={index} value={index.toString()}>
                        Recipient {index + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {previewMessages.map((message, index) => (
                    <TabsContent key={index} value={index.toString()}>
                      <div className="p-4 border rounded-md bg-muted/50 whitespace-pre-wrap">{message}</div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Email Settings</CardTitle>
            <CardDescription>Configure your email sending settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Sender Email</Label>
              <Input
                id="senderEmail"
                placeholder="your-email@example.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
              />
              {errors.senderEmail && <p className="text-sm font-medium text-destructive">{errors.senderEmail}</p>}
              <p className="text-sm text-muted-foreground">The email address you'll use to send emails.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senderPassword">Email Password</Label>
              <Input
                id="senderPassword"
                type="password"
                placeholder="••••••••"
                value={senderPassword}
                onChange={(e) => setSenderPassword(e.target.value)}
              />
              {errors.senderPassword && <p className="text-sm font-medium text-destructive">{errors.senderPassword}</p>}
              <p className="text-sm text-muted-foreground">
                For Gmail, use an App Password.{" "}
                <a
                  href="https://support.google.com/accounts/answer/185833"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Learn how to create one
                </a>
                .
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtpService">SMTP Service</Label>
              <Select value={smtpService} onValueChange={setSmtpService}>
                <SelectTrigger id="smtpService">
                  <SelectValue placeholder="Select an SMTP service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook</SelectItem>
                  <SelectItem value="yahoo">Yahoo</SelectItem>
                  <SelectItem value="custom">Custom SMTP</SelectItem>
                </SelectContent>
              </Select>
              {errors.smtpService && <p className="text-sm font-medium text-destructive">{errors.smtpService}</p>}
              <p className="text-sm text-muted-foreground">Choose your email service provider.</p>
            </div>

            {smtpService === "custom" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customSmtpHost">SMTP Host</Label>
                    <Input
                      id="customSmtpHost"
                      placeholder="smtp.example.com"
                      value={customSmtpHost}
                      onChange={(e) => setCustomSmtpHost(e.target.value)}
                    />
                    {errors.customSmtpHost && (
                      <p className="text-sm font-medium text-destructive">{errors.customSmtpHost}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customSmtpPort">SMTP Port</Label>
                    <Input
                      id="customSmtpPort"
                      placeholder="587"
                      value={customSmtpPort}
                      onChange={(e) => setCustomSmtpPort(e.target.value)}
                    />
                    {errors.customSmtpPort && (
                      <p className="text-sm font-medium text-destructive">{errors.customSmtpPort}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customSmtpSecurity">Security</Label>
                  <Select value={customSmtpSecurity} onValueChange={setCustomSmtpSecurity}>
                    <SelectTrigger id="customSmtpSecurity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS</SelectItem>
                      <SelectItem value="ssl">SSL</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {smtpService === "gmail" && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Gmail SMTP Settings</AlertTitle>
                <AlertDescription>
                  <p>For Gmail, you must:</p>
                  <ol className="list-decimal pl-5 mt-2 space-y-1">
                    <li>Use an App Password (not your regular password)</li>
                    <li>Enable 2-Step Verification on your Google account first</li>
                    <li>Generate an App Password in your Google Account settings</li>
                    <li>
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline flex items-center"
                      >
                        Create App Password <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={testSmtpConnection} disabled={isLoading}>
                Validate SMTP Settings
              </Button>
            </div>

            {smtpTestResult && (
              <Alert className={smtpTestResult.success ? "bg-green-50" : "bg-red-50"}>
                <Info className="h-4 w-4" />
                <AlertTitle>{smtpTestResult.success ? "SMTP Settings Look Valid" : "SMTP Test Failed"}</AlertTitle>
                <AlertDescription>
                  <p>{smtpTestResult.message}</p>
                  {smtpTestResult.previewOnly && (
                    <p className="mt-2 text-amber-600">
                      Note: In the preview environment, we can only validate your settings format. Actual connection
                      testing will be performed when deployed to production.
                    </p>
                  )}
                  {smtpTestResult.smtpDetails && (
                    <div className="mt-2 text-xs font-mono bg-white p-2 rounded border">
                      <p>Service: {smtpTestResult.smtpDetails.service}</p>
                      {smtpTestResult.smtpDetails.host && <p>Host: {smtpTestResult.smtpDetails.host}</p>}
                      {smtpTestResult.smtpDetails.port && <p>Port: {smtpTestResult.smtpDetails.port}</p>}
                      <p>User: {smtpTestResult.smtpDetails.user}</p>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="bg-muted/50 border-t px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Note: In this preview environment, emails cannot actually be sent due to technical limitations. When
              deployed to a production environment, real emails will be sent using the configured SMTP settings.
            </p>
          </CardFooter>
        </Card>

        {sendingResults && (
          <Card>
            <CardHeader>
              <CardTitle>Email Sending Results</CardTitle>
              {sendingResults.preview && (
                <CardDescription>These are simulated results. In production, real emails will be sent.</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-md bg-green-50">
                    <p className="text-sm font-medium text-green-800">Successful</p>
                    <p className="text-2xl font-bold text-green-700">{sendingResults.details.success}</p>
                  </div>
                  <div className="p-4 border rounded-md bg-red-50">
                    <p className="text-sm font-medium text-red-800">Failed</p>
                    <p className="text-2xl font-bold text-red-700">{sendingResults.details.failed}</p>
                  </div>
                </div>

                {sendingResults.details.errors && sendingResults.details.errors.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2">Errors:</h3>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-red-50">
                      <ul className="list-disc pl-5 space-y-1">
                        {sendingResults.details.errors.map((error: string, index: number) => (
                          <li key={index} className="text-sm text-red-700">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {debugInfo.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">Debug Information:</h3>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)}>
                        {showDebug ? "Hide" : "Show"} Details
                      </Button>
                    </div>
                    {showDebug && (
                      <div className="max-h-60 overflow-y-auto border rounded-md p-2 bg-slate-50 text-xs font-mono">
                        {debugInfo.map((info, index) => (
                          <div key={index} className="py-1 border-b border-slate-200 last:border-0">
                            {info}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sendingResults.preview && (
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Preview Mode</AlertTitle>
                    <AlertDescription>
                      These results are simulated. In production, real emails will be sent.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading} size="lg">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Emails...
              </>
            ) : (
              "Send Emails Now"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
