"use client"

import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, ShieldAlert } from "lucide-react"

export type TemplateColumn = {
  column_name: string
  prompt: string
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'percentage'
}

export type ReviewTemplate = {
  id: string
  title: string
  description: string
  recommendedFor: string[]
  defaultName: string
  defaultDescription?: string
  columns: TemplateColumn[]
}

const CONTRACT_TEMPLATES: ReviewTemplate[] = [
  {
    id: "contract_basic",
    title: "Contract Essentials",
    description: "Core fields for most commercial contracts: parties, dates, value, and renewal.",
    recommendedFor: ["Commercial", "MSA", "SaaS", "NDA"],
    defaultName: "Contract Essentials Review",
    defaultDescription: "Extract key contract details for quick indexing and reporting.",
    columns: [
      { column_name: "Counterparty Name", data_type: "text", prompt: "Extract the legal name of the counterparty organization in this contract. Prefer the full legal entity name if available." },
      { column_name: "Effective Date", data_type: "date", prompt: "Extract the contract effective date (the date on which the agreement becomes effective). If multiple dates are present, choose the one explicitly labeled 'Effective Date'." },
      { column_name: "Termination Date", data_type: "date", prompt: "If present, extract the contract termination or end date. If the contract auto-renews, leave this blank." },
      { column_name: "Auto-Renewal", data_type: "boolean", prompt: "Determine if the contract contains an automatic renewal clause. Return 'true' if it auto-renews, otherwise 'false'." },
      { column_name: "Contract Value (USD)", data_type: "currency", prompt: "Extract the total contract value or recurring fee amount in USD. If another currency is specified, convert to USD only if an explicit USD amount is provided; otherwise return the original amount and currency code." },
      { column_name: "Payment Terms", data_type: "text", prompt: "Summarize the payment terms (e.g., Net 30, upfront, milestone-based). Provide only the concise term phrase." },
    ]
  },
  {
    id: "contract_risk_obligations",
    title: "Risk & Obligations",
    description: "Clauses lawyers commonly review for risk, compliance, and obligations.",
    recommendedFor: ["Legal Review", "Compliance", "Procurement"],
    defaultName: "Contract Risk & Obligations Review",
    defaultDescription: "Extract clauses relevant to risk, compliance, and post-signature obligations.",
    columns: [
      { column_name: "Governing Law", data_type: "text", prompt: "Extract the governing law jurisdiction for this agreement (e.g., State of New York, England & Wales)." },
      { column_name: "Jurisdiction/Venue", data_type: "text", prompt: "Extract the jurisdiction or forum for dispute resolution (e.g., state and federal courts in Santa Clara County, CA)." },
      { column_name: "Limitation of Liability", data_type: "text", prompt: "Summarize the limitation of liability clause. Include caps (e.g., fees paid in last 12 months) and exclusions (e.g., indirect damages). Keep it concise." },
      { column_name: "Indemnification", data_type: "text", prompt: "Summarize the indemnification obligations, including which party indemnifies, scope, and exclusions." },
      { column_name: "Confidentiality", data_type: "text", prompt: "Summarize confidentiality obligations including term, scope, and permitted disclosures." },
      { column_name: "Notice Requirements", data_type: "text", prompt: "Extract the notice provision including method (email, courier), addresses, and required lead time." },
      { column_name: "Assignment", data_type: "text", prompt: "Summarize assignment clause including whether assignment requires consent and exceptions (e.g., change of control)." },
    ]
  },
  // New: Data Processing Addendum (DPA) Compliance
  {
    id: "contract_dpa_compliance",
    title: "DPA Compliance",
    description: "Data protection terms for GDPR/CCPA: roles, SCCs, transfers, and security.",
    recommendedFor: ["Privacy", "Security", "DPO", "SaaS"],
    defaultName: "Data Processing Addendum Review",
    defaultDescription: "Extract privacy and security clauses from DPAs and privacy addenda.",
    columns: [
      { column_name: "Roles (Controller/Processor)", data_type: "text", prompt: "Identify each party's role under the DPA (Controller, Processor, Sub-processor)." },
      { column_name: "Personal Data Categories", data_type: "text", prompt: "Summarize the types/categories of personal data processed (e.g., contact details, payment info)." },
      { column_name: "Data Subjects", data_type: "text", prompt: "Summarize categories of data subjects (e.g., customers, employees, end-users)." },
      { column_name: "Cross-Border Transfers", data_type: "text", prompt: "Describe any cross-border data transfers and mechanisms in place (e.g., SCCs, IDTA)." },
      { column_name: "SCCs/IDTA Included", data_type: "boolean", prompt: "Indicate whether Standard Contractual Clauses (or IDTA) are included or incorporated by reference." },
      { column_name: "Security Measures", data_type: "text", prompt: "Summarize technical and organizational security measures (e.g., encryption, access controls, audits)." },
      { column_name: "Retention/Deletion", data_type: "text", prompt: "Summarize retention and deletion obligations after processing ends, including any grace periods." },
    ]
  },
  // New: Employment Agreement Snapshot
  {
    id: "employment_agreement_snapshot",
    title: "Employment Agreement Snapshot",
    description: "Key terms from employment/offer letters: role, pay, restrictive covenants.",
    recommendedFor: ["Employment", "HR", "Recruiting"],
    defaultName: "Employment Agreement Review",
    defaultDescription: "Summarize essential employment terms and covenants.",
    columns: [
      { column_name: "Position/Title", data_type: "text", prompt: "Extract the employee's job title or position." },
      { column_name: "Start Date", data_type: "date", prompt: "Extract the employment start date." },
      { column_name: "Base Compensation (USD)", data_type: "currency", prompt: "Extract base pay in USD if available; otherwise return the stated amount and currency." },
      { column_name: "Bonus/Commission", data_type: "text", prompt: "Summarize bonus or commission eligibility and structure if present." },
      { column_name: "Non-Compete", data_type: "boolean", prompt: "Indicate if a non-compete covenant exists (true/false)." },
      { column_name: "Non-Solicit", data_type: "boolean", prompt: "Indicate if a non-solicitation covenant exists (true/false)." },
      { column_name: "Termination Notice", data_type: "text", prompt: "Summarize termination notice requirements (party, time, conditions)." },
      { column_name: "IP Assignment", data_type: "boolean", prompt: "Indicate if IP assignment and inventions clauses are included (true/false)." },
    ]
  },
  // New: Commercial Lease Highlights
  {
    id: "commercial_lease_highlights",
    title: "Commercial Lease Highlights",
    description: "Lease terms lawyers track: premises, term, rent, escalations, options.",
    recommendedFor: ["Real Estate", "Facilities", "Legal"],
    defaultName: "Commercial Lease Review",
    defaultDescription: "Extract key economic and term details from commercial leases.",
    columns: [
      { column_name: "Premises Address", data_type: "text", prompt: "Extract the address or description of the leased premises." },
      { column_name: "Term Start", data_type: "date", prompt: "Extract the lease term start date (commencement)." },
      { column_name: "Term End", data_type: "date", prompt: "Extract the lease term end date (expiration)." },
      { column_name: "Base Rent (USD)", data_type: "currency", prompt: "Extract base rent amount in USD if available; otherwise return the stated amount and currency." },
      { column_name: "Rent Escalation", data_type: "text", prompt: "Summarize rent escalation schedule (e.g., 3% annual, CPI)." },
      { column_name: "CAM/Operating Charges", data_type: "text", prompt: "Summarize common area maintenance or operating expense obligations." },
      { column_name: "Renewal Options", data_type: "text", prompt: "Summarize renewal/extension options and any notice requirements." },
      { column_name: "Termination Rights", data_type: "text", prompt: "Summarize early termination rights and conditions if any." },
    ]
  },
  // New: NDA Essentials
  {
    id: "nda_essentials",
    title: "NDA Essentials",
    description: "Fast review of NDAs: parties, term, scope, exclusions, and return/destruction.",
    recommendedFor: ["Sales", "BD", "Legal"],
    defaultName: "NDA Review",
    defaultDescription: "Extract core NDA terms for quick triage and tracking.",
    columns: [
      { column_name: "Disclosing Party", data_type: "text", prompt: "Extract the disclosing party's legal name." },
      { column_name: "Receiving Party", data_type: "text", prompt: "Extract the receiving party's legal name." },
      { column_name: "Mutual NDA", data_type: "boolean", prompt: "Indicate if the NDA is mutual (both parties disclose) (true/false)." },
      { column_name: "Term of Confidentiality", data_type: "text", prompt: "Extract the confidentiality term (e.g., 2 years from disclosure, perpetual for trade secrets)." },
      { column_name: "Definition of Confidential Info", data_type: "text", prompt: "Summarize the definition of Confidential Information, including any notable carve-outs." },
      { column_name: "Exclusions", data_type: "text", prompt: "Summarize standard exclusions (already known, independently developed, publicly available, required by law)." },
      { column_name: "Return/Destruction", data_type: "text", prompt: "Describe obligations to return or destroy confidential materials upon request or termination." },
      { column_name: "Governing Law", data_type: "text", prompt: "Extract the governing law jurisdiction for this NDA." },
    ]
  }
]

interface ReviewTemplatesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (template: ReviewTemplate) => void
}

export default function ReviewTemplatesModal({ open, onOpenChange, onApply }: ReviewTemplatesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg">Choose a Review Template</DialogTitle>
          <DialogDescription>Select a contract template to auto-fill columns and details. You can edit everything later.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="px-6 pb-6 max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CONTRACT_TEMPLATES.map((tpl) => (
              <div key={tpl.id} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-blue-100 text-blue-700">
                    {tpl.id === 'contract_risk_obligations' ? <ShieldAlert className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm">{tpl.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{tpl.columns.length} fields</Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-3">{tpl.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.recommendedFor.map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="text-[11px] font-medium text-gray-700">Includes</div>
                      <ul className="mt-1 space-y-1 text-[11px] text-gray-600 list-disc list-inside">
                        {tpl.columns.slice(0, 4).map((c, i) => (
                          <li key={i}>{c.column_name}</li>
                        ))}
                        {tpl.columns.length > 4 && (
                          <li>+ {tpl.columns.length - 4} more…</li>
                        )}
                      </ul>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-[11px] text-gray-500">Default name: <span className="font-medium text-gray-700">{tpl.defaultName}</span></div>
                      <Button size="sm" onClick={() => onApply(tpl)}>
                        Use Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="px-6 pb-4 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
