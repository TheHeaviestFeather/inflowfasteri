import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatArtifactContent } from "@/utils/artifactFormatter";
import { FORMATTER_TEST_FIXTURES, runFormatterTests } from "@/utils/artifactFormatter.test-fixtures";
import { PARSER_TEST_FIXTURES, runParserTests } from "@/hooks/useArtifactParser.test-fixtures";
import { useArtifactParser } from "@/hooks/useArtifactParser";
import { Check, X, Play, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export default function FormatterTest() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"formatter" | "parser">("formatter");
  const [formatterResults, setFormatterResults] = useState<ReturnType<typeof runFormatterTests> | null>(null);
  const [parserResults, setParserResults] = useState<ReturnType<typeof runParserTests> | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<number>(0);
  
  const { parseArtifactsFromContent } = useArtifactParser(null);

  const handleRunFormatterTests = () => {
    const results = runFormatterTests(formatArtifactContent);
    setFormatterResults(results);
  };

  const handleRunParserTests = () => {
    const results = runParserTests((content) => 
      parseArtifactsFromContent(content).map(a => ({ type: a.type, content: a.content }))
    );
    setParserResults(results);
  };

  const handleRunAllTests = () => {
    handleRunFormatterTests();
    handleRunParserTests();
  };

  const currentFormatterFixture = FORMATTER_TEST_FIXTURES[selectedFixture] || FORMATTER_TEST_FIXTURES[0];
  const currentParserFixture = PARSER_TEST_FIXTURES[selectedFixture] || PARSER_TEST_FIXTURES[0];
  
  const formattedOutput = currentFormatterFixture 
    ? formatArtifactContent(currentFormatterFixture.input, currentFormatterFixture.artifactType)
    : "";
  
  const parsedArtifacts = currentParserFixture 
    ? parseArtifactsFromContent(currentParserFixture.input)
    : [];

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
                Test fixtures for formatter and parser regressions
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
            <TabsTrigger value="parser">Parser Tests ({PARSER_TEST_FIXTURES.length})</TabsTrigger>
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

          {/* Parser Tests */}
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
                    Parser: {parserResults.passed}/{parserResults.passed + parserResults.failed} passed
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
              {PARSER_TEST_FIXTURES.map((fixture, idx) => (
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
                  <CardTitle className="text-lg">Parsed Artifacts ({parsedArtifacts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {parsedArtifacts.length === 0 ? (
                      <p className="text-muted-foreground text-sm p-4">No artifacts extracted</p>
                    ) : (
                      <div className="space-y-4">
                        {parsedArtifacts.map((artifact, idx) => (
                          <div key={idx} className="border rounded-lg p-3">
                            <Badge className="mb-2">{artifact.type}</Badge>
                            <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap font-mono max-h-[150px] overflow-auto">
                              {artifact.content.slice(0, 500)}{artifact.content.length > 500 ? "..." : ""}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
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
                    <h4 className="font-medium mb-2 text-green-600">Expected Artifacts</h4>
                    <div className="space-y-2">
                      {currentParserFixture.expectedArtifacts.map((expected, idx) => {
                        const found = parsedArtifacts.find(p => p.type === expected.type);
                        const contentMatches = expected.contentContains?.every(
                          pattern => found?.content.includes(pattern)
                        ) ?? true;
                        const passed = found && contentMatches;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              {passed ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
                              <Badge variant="outline">{expected.type}</Badge>
                            </div>
                            {expected.contentContains && (
                              <div className="ml-6 space-y-0.5">
                                {expected.contentContains.map((pattern, pIdx) => {
                                  const patternFound = found?.content.includes(pattern);
                                  return (
                                    <div key={pIdx} className="flex items-center gap-1 text-xs text-muted-foreground">
                                      {patternFound ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-destructive" />}
                                      <code className="bg-muted px-1 rounded truncate max-w-[200px]">{pattern}</code>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2 text-destructive">Should NOT Find</h4>
                    <div className="space-y-1">
                      {(currentParserFixture.shouldNotFind || []).map((type, idx) => {
                        const found = parsedArtifacts.find(p => p.type === type);
                        return (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {!found ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
                            <Badge variant="outline">{type}</Badge>
                          </div>
                        );
                      })}
                      {(!currentParserFixture.shouldNotFind || currentParserFixture.shouldNotFind.length === 0) && (
                        <p className="text-muted-foreground text-sm">No exclusions specified</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
