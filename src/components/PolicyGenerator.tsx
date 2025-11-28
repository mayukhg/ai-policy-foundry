import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Play, Download, Copy, Settings, CheckCircle, Upload, FileText, 
  X, AlertCircle, Info, Save, Edit, Eye, FileDown, FileUp, Star
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface DocumentContext {
  id: string;
  fileName: string;
  uploadedAt: string;
  metadata: {
    pageCount: number;
    fileSize: number;
    fileType: string;
  };
  extractedData: {
    risks: number;
    controls: number;
    requirements: number;
  };
  validation: {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  };
  status: string;
}

interface PolicyData {
  metadata: any;
  policy: string;
  compliance: any;
  security: any;
  traceability?: {
    sourceDocument: string;
    documentId: string;
    extractedElements: {
      risks: number;
      controls: number;
      requirements: number;
    };
  };
}

export const PolicyGenerator = () => {
  const [selectedService, setSelectedService] = useState("");
  const [businessUnit, setBusinessUnit] = useState("");
  const [environment, setEnvironment] = useState("");
  const [compliance, setCompliance] = useState("");
  const [additionalRequirements, setAdditionalRequirements] = useState("");
  const [policyType, setPolicyType] = useState("");
  
  const [uploadedDocument, setUploadedDocument] = useState<DocumentContext | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  
  const [generatedPolicy, setGeneratedPolicy] = useState<PolicyData | null>(null);
  const [editedPolicy, setEditedPolicy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState("");
  const [feedbackComments, setFeedbackComments] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const cloudServices = [
    "AWS Lambda",
    "AWS S3",
    "AWS EC2",
    "Azure Functions", 
    "Azure Storage",
    "Azure VM",
    "GCP Cloud Functions",
    "GCP Cloud Storage",
    "GCP Compute Engine"
  ];

  const complianceFrameworks = [
    "CIS Benchmarks v1.4.0",
    "NIST Cybersecurity Framework",
    "ISO 27001:2013",
    "SOC 2 Type II",
    "PCI DSS v3.2.1"
  ];

  const policyTypes = [
    "Data Privacy Policy",
    "Data Retention Policy",
    "Access Control Policy",
    "Encryption Policy",
    "Incident Response Policy",
    "General Security Policy"
  ];

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.docx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or DOCX file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB",
        variant: "destructive"
      });
      return;
    }

    handleFileUpload(file);
  }, [toast]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append('document', file);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();
      setUploadedDocument(result.data);
      setIsParsing(false);

      toast({
        title: "Document uploaded successfully",
        description: `Extracted ${result.data.extractedData.risks} risks, ${result.data.extractedData.controls} controls, and ${result.data.extractedData.requirements} requirements`,
      });

    } catch (error: any) {
      setIsUploading(false);
      setIsParsing(false);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleRemoveDocument = () => {
    setUploadedDocument(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGeneratePolicy = async () => {
    if (!selectedService) {
      toast({
        title: "Missing information",
        description: "Please select a cloud service",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const requirements = {
        environment: environment || 'production',
        businessUnit: businessUnit || 'corporate',
        compliance: compliance || 'CIS Benchmarks v1.4.0',
        additionalRequirements: additionalRequirements,
        policyType: policyType
      };

      const requestBody: any = {
        service: selectedService,
        requirements: requirements
      };

      if (uploadedDocument) {
        requestBody.documentId = uploadedDocument.id;
      }

      const response = await fetch(`${API_BASE_URL}/policies/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Policy generation failed');
      }

      const result = await response.json();
      setGeneratedPolicy(result.data);
      setEditedPolicy(result.data.policy);
      setIsEditing(false);

      toast({
        title: "Policy generated successfully",
        description: uploadedDocument 
          ? `Policy generated using context from ${uploadedDocument.fileName}`
          : "Policy generated with standard templates"
      });

    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate policy",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPolicy = () => {
    navigator.clipboard.writeText(editedPolicy || generatedPolicy?.policy || '');
    toast({
      title: "Copied to clipboard",
      description: "Policy content copied successfully"
    });
  };

  const handleExportPDF = async () => {
    if (!generatedPolicy) return;

    try {
      const response = await fetch(`${API_BASE_URL}/policies/${generatedPolicy.metadata?.name || 'policy'}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
        },
        body: JSON.stringify({ format: 'pdf' })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedPolicy.metadata?.name || 'policy'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: "Policy exported as PDF"
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export policy",
        variant: "destructive"
      });
    }
  };

  const handleExportDOCX = async () => {
    if (!generatedPolicy) return;

    try {
      const response = await fetch(`${API_BASE_URL}/policies/${generatedPolicy.metadata?.name || 'policy'}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
        },
        body: JSON.stringify({ format: 'docx' })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedPolicy.metadata?.name || 'policy'}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: "Policy exported as DOCX"
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export policy",
        variant: "destructive"
      });
    }
  };

  const handleSavePolicy = () => {
    // In a real implementation, this would save the edited policy
    toast({
      title: "Policy saved",
      description: "Your changes have been saved"
    });
    setIsEditing(false);
  };

  const handleSubmitFeedback = async () => {
    if (!generatedPolicy || !feedbackRating) {
      toast({
        title: "Feedback incomplete",
        description: "Please provide a rating",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/policies/${generatedPolicy.metadata?.name || 'policy'}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
        },
        body: JSON.stringify({
          rating: parseInt(feedbackRating),
          comments: feedbackComments,
          accuracy: feedbackRating,
          suggestions: feedbackComments
        })
      });

      if (!response.ok) throw new Error('Feedback submission failed');

      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted"
      });

      setShowFeedback(false);
      setFeedbackRating("");
      setFeedbackComments("");
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit feedback",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">AI-Powered Policy Generator</h2>
        <p className="text-xl text-muted-foreground">
          Generate tailored security policies from your risk and control documents
        </p>
      </div>

      {/* Document Upload Section */}
      <Card className="enterprise-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Upload Risk/Control Document (Optional)
          </CardTitle>
          <CardDescription>
            Upload your organization's risk matrix, control documentation, or compliance requirements to generate highly tailored policies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!uploadedDocument ? (
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">Drag and drop your document here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                <p className="text-xs text-muted-foreground">Supported formats: PDF, DOCX (Max 10MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    {isParsing ? 'Parsing document and extracting context...' : 'Uploading...'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{uploadedDocument.fileName}</span>
                    <Badge variant="secondary">
                      {uploadedDocument.extractedData.risks} risks, {uploadedDocument.extractedData.controls} controls
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleRemoveDocument}>
                    <X className="w-4 h-4" />
                  </Button>
                </AlertDescription>
              </Alert>
              
              {uploadedDocument.validation.warnings.length > 0 && (
                <Alert variant="default">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">Document Review Notes:</div>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {uploadedDocument.validation.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Extracted Risks</p>
                  <p className="text-2xl font-bold text-primary">{uploadedDocument.extractedData.risks}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Extracted Controls</p>
                  <p className="text-2xl font-bold text-primary">{uploadedDocument.extractedData.controls}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Extracted Requirements</p>
                  <p className="text-2xl font-bold text-primary">{uploadedDocument.extractedData.requirements}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <Card className="enterprise-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Policy Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="policy-type">Policy Type</Label>
              <Select value={policyType} onValueChange={setPolicyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select policy type" />
                </SelectTrigger>
                <SelectContent>
                  {policyTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Cloud Service</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a cloud service" />
                </SelectTrigger>
                <SelectContent>
                  {cloudServices.map((service) => (
                    <SelectItem key={service} value={service}>{service}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-unit">Business Unit</Label>
              <Select value={businessUnit} onValueChange={setBusinessUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upstream">Upstream</SelectItem>
                  <SelectItem value="downstream">Downstream</SelectItem>
                  <SelectItem value="trading">Trading & Shipping</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compliance">Compliance Framework</Label>
              <Select value={compliance} onValueChange={setCompliance}>
                <SelectTrigger>
                  <SelectValue placeholder="Select compliance framework" />
                </SelectTrigger>
                <SelectContent>
                  {complianceFrameworks.map((framework) => (
                    <SelectItem key={framework} value={framework}>{framework}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements">Additional Requirements</Label>
              <Textarea 
                value={additionalRequirements}
                onChange={(e) => setAdditionalRequirements(e.target.value)}
                placeholder="Enter specific security requirements or constraints..."
                className="min-h-[100px]"
              />
            </div>

            {uploadedDocument && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Policy will be generated using context from <strong>{uploadedDocument.fileName}</strong>
                </AlertDescription>
              </Alert>
            )}

            <Button 
              variant="hero" 
              onClick={handleGeneratePolicy}
              disabled={!selectedService || isGenerating}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating Policy..." : "Generate Security Policy"}
            </Button>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="enterprise-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                {isEditing ? "Edit Policy" : "Generated Policy"}
              </span>
              {generatedPolicy && (
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={handleSavePolicy}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCopyPolicy}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleExportPDF}>
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Star className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Rate This Policy</DialogTitle>
                            <DialogDescription>
                              Help us improve by providing feedback on the generated policy
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Rating (1-5)</Label>
                              <RadioGroup value={feedbackRating} onValueChange={setFeedbackRating}>
                                <div className="flex gap-4">
                                  {[1, 2, 3, 4, 5].map((rating) => (
                                    <div key={rating} className="flex items-center space-x-2">
                                      <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} />
                                      <Label htmlFor={`rating-${rating}`} className="cursor-pointer">
                                        {rating} <Star className="w-4 h-4 inline" />
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </RadioGroup>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="comments">Comments</Label>
                              <Textarea
                                id="comments"
                                value={feedbackComments}
                                onChange={(e) => setFeedbackComments(e.target.value)}
                                placeholder="Share your thoughts on accuracy, suggestions, or improvements..."
                                className="min-h-[100px]"
                              />
                            </div>
                            <Button onClick={handleSubmitFeedback} className="w-full">
                              Submit Feedback
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!generatedPolicy && !isGenerating && (
              <div className="h-[400px] flex items-center justify-center text-center">
                <div>
                  <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Configure your policy settings and click generate to start</p>
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">
                    {uploadedDocument 
                      ? 'AI is analyzing your document and generating tailored policy...'
                      : 'AI is analyzing security requirements...'}
                  </p>
                </div>
              </div>
            )}

            {generatedPolicy && (
              <div className="space-y-4">
                {isEditing ? (
                  <Textarea
                    value={editedPolicy}
                    onChange={(e) => setEditedPolicy(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                  />
                ) : (
                  <Tabs defaultValue="yaml" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="yaml">YAML</TabsTrigger>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                      <TabsTrigger value="terraform">Terraform</TabsTrigger>
                    </TabsList>
                    <TabsContent value="yaml" className="mt-4">
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[400px] text-foreground">
                          <code>{editedPolicy || generatedPolicy.policy}</code>
                        </pre>
                      </div>
                    </TabsContent>
                    <TabsContent value="json" className="mt-4">
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[400px] text-foreground">
                          <code>{JSON.stringify(generatedPolicy, null, 2)}</code>
                        </pre>
                      </div>
                    </TabsContent>
                    <TabsContent value="terraform" className="mt-4">
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[400px] text-foreground">
                          <code># Terraform HCL format conversion in progress...</code>
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Traceability Section */}
      {generatedPolicy?.traceability && (
        <Card className="enterprise-card">
          <CardHeader>
            <CardTitle>Policy Traceability</CardTitle>
            <CardDescription>
              See how your uploaded document informed this policy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold">Source Document</p>
                  <p className="text-sm text-muted-foreground">{generatedPolicy.traceability.sourceDocument}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Risks Incorporated</p>
                  <p className="text-2xl font-bold text-primary">{generatedPolicy.traceability.extractedElements.risks}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Controls Incorporated</p>
                  <p className="text-2xl font-bold text-primary">{generatedPolicy.traceability.extractedElements.controls}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Requirements Incorporated</p>
                  <p className="text-2xl font-bold text-primary">{generatedPolicy.traceability.extractedElements.requirements}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policy Insights */}
      {generatedPolicy && (
        <Card className="enterprise-card">
          <CardHeader>
            <CardTitle>Policy Insights & Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Compliance Mapping</h4>
                <div className="space-y-1">
                  {generatedPolicy.compliance?.controls?.slice(0, 3).map((control: any, idx: number) => (
                    <Badge key={idx} variant="secondary">{control.id || control}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Risk Assessment</h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      generatedPolicy.metadata?.riskLevel === 'high' ? 'bg-destructive' :
                      generatedPolicy.metadata?.riskLevel === 'medium' ? 'bg-warning' : 'bg-success'
                    }`}></div>
                    <span className="text-sm capitalize">{generatedPolicy.metadata?.riskLevel || 'medium'} Risk Level</span>
                  </div>
                  <div className="text-sm text-muted-foreground">Based on service type and configuration</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Next Steps</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Review with security team</p>
                  <p>• Test in staging environment</p>
                  <p>• Schedule deployment</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
