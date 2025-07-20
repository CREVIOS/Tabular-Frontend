// AddColumnModal.tsx - Shadcn Dialog with React Hook Form and Zod validation
import React, { useEffect } from 'react'
import { Plus, AlertCircle, CheckCircle, Loader2, Lightbulb } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface AddColumnModalProps {
  isOpen: boolean
  onClose: () => void
  reviewId: string
  existingColumns: string[]
  onColumnAdded?: () => void
}

// Form schema with Zod validation
const formSchema = z.object({
  column_name: z
    .string()
    .min(2, 'Column name must be at least 2 characters')
    .max(50, 'Column name must be less than 50 characters')
    .trim(),
  prompt: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(500, 'Prompt must be less than 500 characters')
    .trim(),
  data_type: z.enum(['text', 'number', 'date', 'boolean', 'currency', 'percentage'])
})

type FormData = z.infer<typeof formSchema>

const DATA_TYPE_OPTIONS = [
  { value: 'text', label: 'Text', description: 'General text content' },
  { value: 'number', label: 'Number', description: 'Numeric values' },
  { value: 'date', label: 'Date', description: 'Dates (YYYY-MM-DD format)' },
  { value: 'boolean', label: 'Yes/No', description: 'True/false values' },
  { value: 'currency', label: 'Currency', description: 'Monetary amounts' },
  { value: 'percentage', label: 'Percentage', description: 'Percentage values' }
]

const EXAMPLE_PROMPTS = [
  {
    name: 'Company Name',
    prompt: 'Extract the primary company or organization name mentioned in this document',
    type: 'text' as const
  },
  {
    name: 'Total Amount',
    prompt: 'Find the total monetary amount, sum, or final cost mentioned in the document',
    type: 'currency' as const
  },
  {
    name: 'Contract Date',
    prompt: 'Extract the contract date, agreement date, or effective date from the document',
    type: 'date' as const
  },
  {
    name: 'Is Signed',
    prompt: 'Determine if this document has been signed or contains signatures',
    type: 'boolean' as const
  },
  {
    name: 'Revenue',
    prompt: 'Extract the annual revenue, total revenue, or income figure from the document',
    type: 'currency' as const
  },
  {
    name: 'Document Type',
    prompt: 'Identify the type of document (e.g., contract, invoice, report, agreement)',
    type: 'text' as const
  }
]

export default function AddColumnModal({ 
  isOpen, 
  onClose, 
  reviewId, 
  existingColumns,
  onColumnAdded 
}: AddColumnModalProps) {
  const [showExamples, setShowExamples] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
    column_name: '',
    prompt: '',
    data_type: 'text'
    }
  })

  const { isSubmitting } = form.formState

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset()
      setLocalError(null)
      setShowExamples(false)
      setSuccess(false)
    }
  }, [isOpen, form])

  // Custom validation for existing column names
  const validateColumnName = (value: string) => {
    if (existingColumns.some(col => 
      col.toLowerCase() === value.toLowerCase()
    )) {
      return 'Column name already exists'
    }
    return true
  }
  
  // Handle example selection
  const handleExampleSelect = (example: typeof EXAMPLE_PROMPTS[0]) => {
    form.setValue('column_name', example.name)
    form.setValue('prompt', example.prompt)
    form.setValue('data_type', example.type)
    setShowExamples(false)
  }
  
  // Handle form submission
  const onSubmit = async (data: FormData) => {
    setLocalError(null)
    setSuccess(false)
    
    // Additional validation for existing columns
    const columnNameError = validateColumnName(data.column_name)
    if (columnNameError !== true) {
      form.setError('column_name', { message: columnNameError })
      return
    }

    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        setLocalError('Authentication error. Please log in again.')
        return
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://app2.makebell.com:8443'
      const response = await fetch(`${backendUrl}/api/reviews/${reviewId}/columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          column_name: data.column_name,
          prompt: data.prompt,
          data_type: data.data_type
        })
      })

      if (!response.ok) {
        let message = 'Failed to add column.'
        try {
          const errorData = await response.json()
          message = errorData.detail || errorData.message || message
        } catch {}
        setLocalError(message)
        return
      }

      // Success
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        if (onColumnAdded) onColumnAdded()
        onClose()
      }, 1200)

    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to add column')
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Analysis Column</DialogTitle>
          <DialogDescription>
            Create a new column to extract specific data from your documents.
          </DialogDescription>
        </DialogHeader>
        
        {/* Success/Error Alerts */}
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Column added successfully! Analysis in progress...
            </AlertDescription>
          </Alert>
        )}
        
        {localError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Example Templates */}
            <Collapsible open={showExamples} onOpenChange={setShowExamples}>
              <div className="border rounded-lg p-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="p-0 h-auto justify-start">
                    <div className="flex items-center gap-2 text-sm">
                      <Lightbulb className="h-4 w-4" />
                      <span className="font-medium">Example Templates</span>
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXAMPLE_PROMPTS.map((example, index) => (
                      <div 
                      key={index}
                        className="cursor-pointer hover:bg-gray-50 p-2 rounded border text-xs"
                      onClick={() => handleExampleSelect(example)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{example.name}</h4>
                            <p className="text-gray-600 mt-1 line-clamp-2">{example.prompt}</p>
                          </div>
                          <Badge variant="outline" className="text-xs ml-2">
                            {example.type}
                          </Badge>
                        </div>
                      </div>
                  ))}
                </div>
                </CollapsibleContent>
            </div>
            </Collapsible>
            
            {/* Column Name and Data Type - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="column_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Column Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Company Name, Total Amount"
                        {...field}
                        className="focus:ring-2 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {field.value?.length || 0}/50 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Data Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DATA_TYPE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
            <div>
                              <div className="font-medium">{option.label}</div>
                              <div className="text-xs text-muted-foreground">{option.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Analysis Prompt Field */}
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Analysis Prompt *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe exactly what information you want to extract from each document. Be specific and clear about what to look for..."
                      className="min-h-[100px] focus:ring-2 focus:ring-blue-500 resize-none"
                      {...field}
              />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {field.value?.length || 0}/500 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        
        <DialogFooter className="gap-2">
          <Button
              type="button"
            variant="outline"
              onClick={onClose}
            disabled={isSubmitting}
            >
              Cancel
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="min-w-[120px]"
            >
            {isSubmitting ? (
                <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                <Plus className="h-4 w-4 mr-2" />
                  Add Column
                </>
              )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
