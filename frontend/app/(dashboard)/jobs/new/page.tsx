"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  FileText,
  Upload,
  Sparkles,
  Loader2,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { jdApi } from "@/lib/api/client";
import { toast } from "sonner";

type InputMethod = "text" | "voice" | "upload";

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function NewJobPage() {
  const router = useRouter();
  const [inputMethod, setInputMethod] = useState<InputMethod>("text");
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedJD, setGeneratedJD] = useState<Record<string, unknown> | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isRecordingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Initialize speech recognition once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("Speech recognition started");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log("Got speech result", event.results.length);
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setInputText((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please enable it in your browser settings.");
      } else if (event.error === "no-speech") {
        toast.info("No speech detected. Try speaking louder or closer to the microphone.");
      } else if (event.error !== "aborted") {
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended, isRecording:", isRecordingRef.current);
      // Restart if still supposed to be recording
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart recognition:", e);
          setIsRecording(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []); // Empty dependency array - only run once

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      toast.error("Please enter job requirements");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await jdApi.create({ input_text: inputText });
      setGeneratedJD(response.data);
      toast.success("Job description generated successfully!");
    } catch (error) {
      console.error("Error generating JD:", error);
      toast.error("Failed to generate job description. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    if (!isRecording) {
      // Start recording
      setInterimTranscript("");
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        toast.info("Listening... Speak your job requirements.");
      } catch (error) {
        console.error("Failed to start recording:", error);
        toast.error("Failed to start recording. Please try again.");
      }
    } else {
      // Stop recording
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript("");
      toast.success("Recording stopped. Review your transcript below.");
    }
  };

  const inputMethods = [
    {
      id: "text" as InputMethod,
      label: "Text Input",
      description: "Type your requirements",
      icon: FileText,
    },
    {
      id: "voice" as InputMethod,
      label: "Voice Input",
      description: "Speak your requirements",
      icon: Mic,
    },
    {
      id: "upload" as InputMethod,
      label: "Upload JD",
      description: "Enhance existing JD",
      icon: Upload,
    },
  ];

  if (generatedJD) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Review Generated JD
            </h1>
            <p className="text-sm text-slate-500">
              Review and edit the AI-generated job description
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setGeneratedJD(null)}
              className="px-4 py-2 bg-white/60 dark:bg-slate-800/60 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white transition-all"
            >
              Start Over
            </button>
            <button
              onClick={() => {
                toast.success("Job saved as draft!");
                router.push("/jobs");
              }}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              Save as Draft
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Basic Info */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Basic Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    defaultValue={(generatedJD as { title?: string }).title || ""}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 rounded-xl border-0 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    defaultValue={(generatedJD as { department?: string }).department || ""}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 rounded-xl border-0 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    defaultValue={(generatedJD as { location?: string }).location || ""}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 rounded-xl border-0 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Remote Policy
                  </label>
                  <select
                    defaultValue={(generatedJD as { remote_policy?: string }).remote_policy || "hybrid"}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 rounded-xl border-0 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">Onsite</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Job Description
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Summary
                  </label>
                  <textarea
                    rows={3}
                    defaultValue={(generatedJD as { summary?: string }).summary || ""}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 rounded-xl border-0 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Full Description
                  </label>
                  <textarea
                    rows={6}
                    defaultValue={(generatedJD as { description?: string }).description || ""}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 rounded-xl border-0 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Skills Matrix */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Skills Matrix
              </h2>
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-500">Required Skills</p>
                <div className="flex flex-wrap gap-2">
                  {((generatedJD as { skills_matrix?: { required?: Array<{ skill: string }> } }).skills_matrix?.required || []).map(
                    (skill: { skill: string }, i: number) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg"
                      >
                        {skill.skill}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Salary Range */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                Salary Range
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Min
                  </label>
                  <input
                    type="number"
                    defaultValue={(generatedJD as { salary_range?: { min?: number } }).salary_range?.min || ""}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-slate-800/50 rounded-xl border-0 text-sm"
                  />
                </div>
                <span className="mt-5 text-slate-400">-</span>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Max
                  </label>
                  <input
                    type="number"
                    defaultValue={(generatedJD as { salary_range?: { max?: number } }).salary_range?.max || ""}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-slate-800/50 rounded-xl border-0 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          Create Job Description
        </h1>
        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          Use JD Assist AI to create comprehensive job descriptions from your
          requirements. Choose your preferred input method below.
        </p>
      </div>

      {/* Input Method Selection */}
      <div className="grid grid-cols-3 gap-4">
        {inputMethods.map((method) => (
          <button
            key={method.id}
            onClick={() => setInputMethod(method.id)}
            className={cn(
              "glass-card rounded-2xl p-5 text-left transition-all hover:shadow-lg",
              inputMethod === method.id && "ring-2 ring-primary shadow-lg"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                inputMethod === method.id
                  ? "bg-primary text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600"
              )}
            >
              <method.icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white">
              {method.label}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{method.description}</p>
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="glass-card rounded-3xl p-6">
        {inputMethod === "text" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Describe your ideal candidate and role requirements
              </label>
              <span className="text-xs text-slate-400">
                {inputText.length} / 5000 characters
              </span>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Example: We're looking for a Senior Frontend Engineer with 5+ years of React experience. They should be proficient in TypeScript, familiar with modern state management, and have experience building scalable web applications. The role involves leading technical initiatives and mentoring junior developers..."
              rows={8}
              className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl border-0 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
        )}

        {inputMethod === "voice" && (
          <div className="text-center py-8">
            <button
              onClick={toggleRecording}
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 transition-all",
                isRecording
                  ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50"
                  : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
              )}
            >
              {isRecording ? (
                <MicOff className="w-10 h-10" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
            <p className="text-sm text-slate-500 mb-2">
              {isRecording
                ? "Listening... Click to stop"
                : "Click to start recording your requirements"}
            </p>
            {isRecording && (
              <p className="text-xs text-slate-400">
                Speak clearly about the job role, required skills, and qualifications
              </p>
            )}

            {/* Live transcript */}
            {(inputText || interimTranscript) && (
              <div className="mt-6 p-4 bg-white/50 dark:bg-slate-800/50 rounded-2xl text-left max-h-60 overflow-y-auto">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  {isRecording ? "Live Transcript:" : "Transcript:"}
                </p>
                <p className="text-sm text-slate-800 dark:text-white whitespace-pre-wrap">
                  {inputText}
                  {interimTranscript && (
                    <span className="text-slate-400 italic">{interimTranscript}</span>
                  )}
                </p>
              </div>
            )}

            {/* Clear button */}
            {inputText && !isRecording && (
              <button
                onClick={() => setInputText("")}
                className="mt-3 text-xs text-slate-500 hover:text-red-500 transition-colors"
              >
                Clear transcript
              </button>
            )}
          </div>
        )}

        {inputMethod === "upload" && (
          <div className="text-center py-8">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-8 hover:border-primary transition-colors cursor-pointer">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Drag and drop your existing JD here
              </p>
              <p className="text-xs text-slate-400">
                Supports PDF, DOCX, or TXT files
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !inputText.trim()}
          className={cn(
            "flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg transition-all",
            isGenerating || !inputText.trim()
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating with AI...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Job Description
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      {/* Tips */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-semibold text-slate-800 dark:text-white mb-3">
          Tips for better results
        </h3>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            Include specific technical skills and years of experience required
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            Mention the team structure and reporting relationships
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            Describe key responsibilities and expected outcomes
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            Include location preferences and remote work policy
          </li>
        </ul>
      </div>
    </div>
  );
}
