import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatArtifactContent } from "@/utils/artifactFormatter";
import { FORMATTER_TEST_FIXTURES, runFormatterTests } from "@/utils/artifactFormatter.test-fixtures";
import { Check, X, Play, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export default function FormatterTest() {
  const navigate = useNavigate();
  const [testResults, setTestResults] = useState<ReturnType<typeof runFormatterTests> | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<number>(0);

  const handleRunTests = () => {
    const results = runFormatterTests(formatArtifactContent);
    setTestResults(results);
  };

  const currentFixture = FORMATTER_TEST_FIXTURES[selectedFixture];
  const formattedOutput = formatArtifactContent(currentFixture.input, currentFixture.artifactType);

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
              <h1 className="text-2xl font-bold">Artifact Formatter Test Suite</h1>
              <p className="text-muted-foreground">
                Test fixtures for catching formatting regressions
              </p>
            </div>
          </div>
          <Button onClick={handleRunTests} className="gap-2">
            <Play className="h-4 w-4" />
            Run All Tests
          </Button>
        </div>

        {/* Test Results Summary */}
        {testResults && (
          <Card className={cn(
            "border-2",
            testResults.failed === 0 ? "border-green-500 bg-green-500/5" : "border-destructive bg-destructive/5"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                {testResults.failed === 0 ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <X className="h-5 w-5 text-destructive" />
                )}
                Test Results: {testResults.passed}/{testResults.passed + testResults.failed} passed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {testResults.results.map((result, idx) => (
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
            <CardTitle>{currentFixture.name}</CardTitle>
            <CardDescription>{currentFixture.description}</CardDescription>
            <Badge variant="secondary" className="w-fit">
              Type: {currentFixture.artifactType}
            </Badge>
          </CardHeader>
        </Card>

        {/* Input / Output Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Raw Input</CardTitle>
              <CardDescription>Malformed content before formatting</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <pre className="text-xs bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono">
                  {currentFixture.input}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Output */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Formatted Output</CardTitle>
              <CardDescription>After formatter processing</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="rendered">
                <TabsList className="mb-3">
                  <TabsTrigger value="rendered">Rendered</TabsTrigger>
                  <TabsTrigger value="raw">Raw Markdown</TabsTrigger>
                </TabsList>
                <TabsContent value="rendered">
                  <ScrollArea className="h-[350px]">
                    <div className={cn(
                      "prose prose-sm max-w-none dark:prose-invert p-4 bg-muted/30 rounded-lg border",
                      "prose-headings:text-foreground prose-headings:font-semibold",
                      "prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:border-b prose-h2:pb-2 prose-h2:border-border",
                      "prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2",
                      "prose-ul:my-2 prose-ul:pl-5",
                      "prose-li:my-1",
                      "prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:italic"
                    )}>
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
                <h4 className="font-medium mb-2 text-green-600">Expected Patterns (should appear)</h4>
                <div className="space-y-1">
                  {currentFixture.expectedPatterns.map((pattern, idx) => {
                    const found = formattedOutput.includes(pattern);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {found ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          {pattern.length > 50 ? pattern.slice(0, 50) + "..." : pattern}
                        </code>
                      </div>
                    );
                  })}
                  {currentFixture.expectedPatterns.length === 0 && (
                    <p className="text-muted-foreground text-sm">No specific patterns required</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-destructive">Unexpected Patterns (should NOT appear)</h4>
                <div className="space-y-1">
                  {currentFixture.unexpectedPatterns.map((pattern, idx) => {
                    const found = formattedOutput.includes(pattern);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {!found ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          {pattern}
                        </code>
                      </div>
                    );
                  })}
                  {currentFixture.unexpectedPatterns.length === 0 && (
                    <p className="text-muted-foreground text-sm">No patterns to exclude</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
