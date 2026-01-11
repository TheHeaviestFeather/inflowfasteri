import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatArtifactContent } from "@/utils/artifactFormatter";
import { FORMATTER_TEST_FIXTURES, runFormatterTests } from "@/utils/artifactFormatter.test-fixtures";
import { parseAIResponse, AIResponseSchema } from "@/lib/aiResponseSchema";
import { Check, X, Play, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// Test fixtures for JSON schema parser
const SCHEMA_PARSER_TEST_FIXTURES = [
  {
    name: "Valid complete response",
    description: "Full JSON response with message, artifact, and state",
    input: JSON.stringify({
      message: "Here is your Phase 1 Contract.",
      artifact: {
        type: "phase_1_contract",
        title: "Project Contract",
        content: "# Phase 1 Contract\n\n## Objectives\n\n- Define scope\n- Set timeline",
        status: "draft"
      },
      state: {
        mode: "STANDARD",
        pipeline_stage: "discovery"
      },
      next_actions: ["Review the contract", "Approve to proceed"]
    }, null, 2),
    shouldParse: true,
    expectedMessage: "Here is your Phase 1 Contract.",
    expectedArtifactType: "phase_1_contract",
  },
  {
    name: "Message only response",
    description: "Simple conversational response without artifact",
    input: JSON.stringify({
      message: "I understand. Let me ask some clarifying questions about your project goals."
    }),
    shouldParse: true,
    expectedMessage: "I understand. Let me ask some clarifying questions about your project goals.",
    expectedArtifactType: null,
  },
  {
    name: "Invalid JSON",
    description: "Malformed JSON that should fail parsing",
    input: "This is not JSON at all, just plain text.",
    shouldParse: false,
    expectedMessage: null,
    expectedArtifactType: null,
  },
  {
    name: "Missing required message field",
    description: "JSON missing the required message field",
    input: JSON.stringify({
      artifact: {
        type: "discovery_report",
        title: "Discovery",
        content: "Some content here"
      }
    }),
    shouldParse: false,
    expectedMessage: null,
    expectedArtifactType: null,
  },
  {
    name: "Invalid artifact type",
    description: "Artifact with non-existent type",
    input: JSON.stringify({
      message: "Here is your deliverable.",
      artifact: {
        type: "invalid_type_xyz",
        title: "Invalid",
        content: "Some content"
      }
    }),
    shouldParse: false,
    expectedMessage: null,
    expectedArtifactType: null,
  },
];

export default function FormatterTest() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"formatter" | "parser">("formatter");
  const [formatterResults, setFormatterResults] = useState<ReturnType<typeof runFormatterTests> | null>(null);
  const [parserResults, setParserResults] = useState<{ passed: number; failed: number; results: Array<{ fixture: string; passed: boolean; error?: string }> } | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<number>(0);

  const handleRunFormatterTests = () => {
    const results = runFormatterTests(formatArtifactContent);
    setFormatterResults(results);
  };

  const handleRunParserTests = () => {
    const results = SCHEMA_PARSER_TEST_FIXTURES.map(fixture => {
      const parseResult = parseAIResponse(fixture.input);
      
      let passed = false;
      let error: string | undefined;
      
      if (fixture.shouldParse) {
        if (!parseResult.success) {
          passed = false;
          error = parseResult.error;
        } else {
          const messageMatches = parseResult.data?.message === fixture.expectedMessage;
          const artifactMatches = fixture.expectedArtifactType 
            ? parseResult.data?.artifact?.type === fixture.expectedArtifactType
            : !parseResult.data?.artifact;
          
          passed = messageMatches && artifactMatches;
          if (!passed) {
            error = `Expected message: "${fixture.expectedMessage}", got: "${parseResult.data?.message}"`;
          }
        }
      } else {
        passed = !parseResult.success;
        if (!passed) {
          error = "Expected parse to fail but it succeeded";
        }
      }
      
      return { fixture: fixture.name, passed, error };
    });
    
    setParserResults({
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results
    });
  };

  const handleRunAllTests = () => {
    handleRunFormatterTests();
    handleRunParserTests();
  };

  const currentFormatterFixture = FORMATTER_TEST_FIXTURES[selectedFixture] || FORMATTER_TEST_FIXTURES[0];
  const currentParserFixture = SCHEMA_PARSER_TEST_FIXTURES[selectedFixture] || SCHEMA_PARSER_TEST_FIXTURES[0];
  
  const formattedOutput = currentFormatterFixture 
    ? formatArtifactContent(currentFormatterFixture.input, currentFormatterFixture.artifactType)
    : "";
  
  const parsedResult = currentParserFixture 
    ? parseAIResponse(currentParserFixture.input)
    : { success: false };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Artifact Test Suite</h1>
              <p className="text-muted-foreground">
                Test fixtures for formatter and JSON schema parser
              </p>
            </div>
          </div>
          <Button onClick={handleRunAllTests} className="gap-2">
            <Play className="h-4 w-4" />
            Run All Tests
          </Button>
        </div>

        {/* Test Type Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "formatter" | "parser"); setSelectedFixture(0); }}>
          <TabsList>
            <TabsTrigger value="formatter">Formatter Tests ({FORMATTER_TEST_FIXTURES.length})</TabsTrigger>
            <TabsTrigger value="parser">Schema Parser Tests ({SCHEMA_PARSER_TEST_FIXTURES.length})</TabsTrigger>
          </TabsList>

          {/* Formatter Tests */}
          <TabsContent value="formatter" className="space-y-6 mt-6">
            {/* Test Results Summary */}
            {formatterResults && (
              <Card className={cn(
                "border-2",
                formatterResults.failed === 0 ? "border-green-500 bg-green-500/5" : "border-destructive bg-destructive/5"
              )}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    {formatterResults.failed === 0 ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-destructive" />
                    )}
                    Formatter: {formatterResults.passed}/{formatterResults.passed + formatterResults.failed} passed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {formatterResults.results.map((result, idx) => (
                      <Badge
                        key={idx}
                        variant={result.passed ? "default" : "destructive"}
                        className="cursor-pointer"
                        onClick={() => setSelectedFixture(idx)}
                      >
                        {result.passed ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                        {result.fixture}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fixture Selector */}
            <div className="flex gap-2 flex-wrap">
              {FORMATTER_TEST_FIXTURES.map((fixture, idx) => (
                <Button
                  key={idx}
                  variant={selectedFixture === idx ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFixture(idx)}
                >
                  {fixture.name}
                </Button>
              ))}
            </div>

            {/* Current Fixture Details */}
            <Card>
              <CardHeader>
                <CardTitle>{currentFormatterFixture.name}</CardTitle>
                <CardDescription>{currentFormatterFixture.description}</CardDescription>
                <Badge variant="secondary" className="w-fit">
                  Type: {currentFormatterFixture.artifactType}
                </Badge>
              </CardHeader>
            </Card>

            {/* Input / Output Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Raw Input</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <pre className="text-xs bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono">
                      {currentFormatterFixture.input}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Formatted Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="rendered">
                    <TabsList className="mb-3">
                      <TabsTrigger value="rendered">Rendered</TabsTrigger>
                      <TabsTrigger value="raw">Raw</TabsTrigger>
                    </TabsList>
                    <TabsContent value="rendered">
                      <ScrollArea className="h-[350px]">
                        <div className="prose prose-sm max-w-none dark:prose-invert p-4 bg-muted/30 rounded-lg border">
                          <ReactMarkdown>{formattedOutput}</ReactMarkdown>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="raw">
                      <ScrollArea className="h-[350px]">
                        <pre className="text-xs bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono">
                          {formattedOutput}
                        </pre>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Assertions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Test Assertions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2 text-green-600">Expected Patterns</h4>
                    <div className="space-y-1">
                      {currentFormatterFixture.expectedPatterns.map((pattern, idx) => {
                        const found = formattedOutput.includes(pattern);
                        return (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {found ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs truncate max-w-[300px]">{pattern}</code>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2 text-destructive">Unexpected Patterns</h4>
                    <div className="space-y-1">
                      {currentFormatterFixture.unexpectedPatterns.map((pattern, idx) => {
                        const found = formattedOutput.includes(pattern);
                        return (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {!found ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{pattern}</code>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schema Parser Tests */}
          <TabsContent value="parser" className="space-y-6 mt-6">
            {/* Test Results Summary */}
            {parserResults && (
              <Card className={cn(
                "border-2",
                parserResults.failed === 0 ? "border-green-500 bg-green-500/5" : "border-destructive bg-destructive/5"
              )}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    {parserResults.failed === 0 ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-destructive" />
                    )}
                    Schema Parser: {parserResults.passed}/{parserResults.passed + parserResults.failed} passed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {parserResults.results.map((result, idx) => (
                      <Badge
                        key={idx}
                        variant={result.passed ? "default" : "destructive"}
                        className="cursor-pointer"
                        onClick={() => setSelectedFixture(idx)}
                      >
                        {result.passed ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                        {result.fixture}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fixture Selector */}
            <div className="flex gap-2 flex-wrap">
              {SCHEMA_PARSER_TEST_FIXTURES.map((fixture, idx) => (
                <Button
                  key={idx}
                  variant={selectedFixture === idx ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFixture(idx)}
                >
                  {fixture.name}
                </Button>
              ))}
            </div>

            {/* Current Fixture Details */}
            <Card>
              <CardHeader>
                <CardTitle>{currentParserFixture.name}</CardTitle>
                <CardDescription>{currentParserFixture.description}</CardDescription>
                <div className="flex gap-2 mt-2">
                  <Badge variant={currentParserFixture.shouldParse ? "default" : "destructive"}>
                    {currentParserFixture.shouldParse ? "Should Parse" : "Should Fail"}
                  </Badge>
                  {currentParserFixture.expectedArtifactType && (
                    <Badge variant="secondary">Artifact: {currentParserFixture.expectedArtifactType}</Badge>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Input / Parsed Output */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Raw Input</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <pre className="text-xs bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono">
                      {currentParserFixture.input}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Parse Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4 p-4">
                      <div className="flex items-center gap-2">
                        {parsedResult.success ? (
                          <Badge className="bg-green-500">✓ Parsed Successfully</Badge>
                        ) : (
                          <Badge variant="destructive">✗ Parse Failed</Badge>
                        )}
                      </div>
                      
                      {parsedResult.success && parsedResult.data && (
                        <>
                          <div>
                            <h4 className="font-medium text-sm mb-1">Message:</h4>
                            <p className="text-sm bg-muted p-2 rounded">{parsedResult.data.message}</p>
                          </div>
                          
                          {parsedResult.data.artifact && (
                            <div>
                              <h4 className="font-medium text-sm mb-1">Artifact:</h4>
                              <div className="bg-muted p-2 rounded space-y-1">
                                <p className="text-sm"><strong>Type:</strong> {parsedResult.data.artifact.type}</p>
                                <p className="text-sm"><strong>Title:</strong> {parsedResult.data.artifact.title}</p>
                                <p className="text-sm"><strong>Content length:</strong> {parsedResult.data.artifact.content.length} chars</p>
                              </div>
                            </div>
                          )}
                          
                          {parsedResult.data.state && (
                            <div>
                              <h4 className="font-medium text-sm mb-1">State:</h4>
                              <pre className="text-xs bg-muted p-2 rounded">
                                {JSON.stringify(parsedResult.data.state, null, 2)}
                              </pre>
                            </div>
                          )}
                        </>
                      )}
                      
                      {!parsedResult.success && parsedResult.error && (
                        <div>
                          <h4 className="font-medium text-sm mb-1 text-destructive">Error:</h4>
                          <p className="text-sm bg-destructive/10 text-destructive p-2 rounded">{parsedResult.error}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Schema Reference */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">JSON Schema Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
{`{
  "message": "string (required)",
  "artifact": {
    "type": "phase_1_contract | discovery_report | learner_persona | design_strategy | design_blueprint | scenario_bank | assessment_kit | final_audit | performance_recommendation_report",
    "title": "string (required)",
    "content": "string (required, min 20 chars)",
    "status": "draft | ready_for_review (default: draft)"
  },
  "state": {
    "mode": "STANDARD | QUICK",
    "pipeline_stage": "string",
    "threshold_percent": "number (0-100, optional)"
  },
  "next_actions": ["string", "..."]
}`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}