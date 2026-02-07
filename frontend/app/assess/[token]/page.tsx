"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Play,
  Pause,
  Square,
  Clock,
  ChevronRight,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { assessmentApi } from "@/lib/api/client";
import { toast } from "sonner";

interface AssessmentQuestion {
  question_id: string;
  question_type: string;
  question_text: string;
  time_limit_seconds: number;
  follow_up_prompts: string[];
}

interface AssessmentData {
  assessment_id: string;
  status: string;
  questions: AssessmentQuestion[];
  duration_minutes: number;
  job_title: string | null;
  candidate_name: string | null;
}

type Stage = "intro" | "setup" | "recording" | "review" | "complete";

export default function CandidateAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [recordedBlobs, setRecordedBlobs] = useState<Map<string, Blob>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch assessment data
  useEffect(() => {
    async function fetchAssessment() {
      try {
        const response = await assessmentApi.getByToken(token);
        setAssessment(response.data);

        if (response.data.status === "completed" || response.data.status === "analyzed") {
          setStage("complete");
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Assessment not found or expired");
      }
      setLoading(false);
    }

    fetchAssessment();
  }, [token]);

  // Setup camera
  const setupCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStage("setup");
    } catch (err) {
      toast.error("Could not access camera/microphone. Please check permissions.");
      console.error("Media error:", err);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current || !assessment) return;

    chunksRef.current = [];

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm;codecs=vp9",
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const questionId = assessment.questions[currentQuestionIndex].question_id;
      setRecordedBlobs((prev) => new Map(prev).set(questionId, blob));
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setIsRecording(true);

    // Start timer
    const timeLimit = assessment.questions[currentQuestionIndex].time_limit_seconds;
    setTimeRemaining(timeLimit);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [assessment, currentQuestionIndex]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // Move to next question
  const nextQuestion = useCallback(() => {
    if (!assessment) return;

    if (currentQuestionIndex < assessment.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setStage("recording");
    } else {
      setStage("review");
    }
  }, [assessment, currentQuestionIndex]);

  // Submit assessment
  const submitAssessment = async () => {
    if (!assessment) return;

    setSubmitting(true);

    try {
      // Combine all recorded blobs into one video
      const allBlobs = Array.from(recordedBlobs.values());
      const combinedBlob = new Blob(allBlobs, { type: "video/webm" });

      // Create file and upload
      const file = new File([combinedBlob], `assessment-${assessment.assessment_id}.webm`, {
        type: "video/webm",
      });

      const formData = new FormData();
      formData.append("assessment_id", assessment.assessment_id);
      formData.append("file", file);

      await assessmentApi.submitVideo(assessment.assessment_id, formData);

      toast.success("Assessment submitted successfully!");
      setStage("complete");
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Failed to submit assessment. Please try again.");
    }

    setSubmitting(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
          <p className="text-zinc-500">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-zinc-900 mb-2">Assessment Not Available</h1>
          <p className="text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!assessment) return null;

  const currentQuestion = assessment.questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-zinc-900">Video Assessment</h1>
            {assessment.job_title && (
              <p className="text-sm text-zinc-500">{assessment.job_title}</p>
            )}
          </div>
          {assessment.candidate_name && (
            <p className="text-sm text-zinc-700">
              {assessment.candidate_name}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Intro Stage */}
        {stage === "intro" && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Video className="w-10 h-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-4">
              Welcome to Your Video Assessment
            </h2>
            <p className="text-zinc-700 mb-6 max-w-lg mx-auto">
              You&apos;ll be asked {assessment.questions.length} questions. Take your time to think
              before recording. Each question has a time limit displayed on screen.
            </p>

            <div className="bg-zinc-50 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-zinc-900 mb-3">Before you start:</h3>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Find a quiet place with good lighting
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Ensure your camera and microphone work
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Plan for about {assessment.duration_minutes} minutes total
                </li>
              </ul>
            </div>

            <button
              onClick={setupCamera}
              className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors shadow-sm"
            >
              Start Setup
            </button>
          </div>
        )}

        {/* Setup Stage */}
        {stage === "setup" && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-xl font-bold text-zinc-900 mb-6 text-center">
              Camera Setup
            </h2>

            {/* Video Preview */}
            <div className="relative bg-zinc-900 rounded-lg overflow-hidden mb-6 aspect-video max-w-2xl mx-auto shadow-sm">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full text-white text-sm">
                  <Camera className="w-4 h-4" />
                  Camera Ready
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full text-white text-sm">
                  <Mic className="w-4 h-4" />
                  Mic Ready
                </div>
              </div>
            </div>

            <p className="text-center text-zinc-500 mb-6">
              Make sure you can see yourself clearly and your microphone is working.
            </p>

            <div className="flex justify-center">
              <button
                onClick={() => setStage("recording")}
                className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
              >
                Begin Assessment
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Recording Stage */}
        {stage === "recording" && currentQuestion && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            {/* Progress */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-medium text-zinc-500">
                Question {currentQuestionIndex + 1} of {assessment.questions.length}
              </span>
              <span className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                isRecording ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-600"
              )}>
                <Clock className="w-4 h-4" />
                {formatTime(timeRemaining || currentQuestion.time_limit_seconds)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-zinc-200 rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${((currentQuestionIndex + (isRecording ? 0.5 : 0)) / assessment.questions.length) * 100}%`,
                }}
              />
            </div>

            {/* Question */}
            <div className="bg-zinc-50 rounded-lg p-6 mb-6 shadow-sm">
              <span className="text-xs font-medium text-accent uppercase tracking-wide">
                {currentQuestion.question_type} Question
              </span>
              <p className="text-lg font-medium text-zinc-900 mt-2">
                {currentQuestion.question_text}
              </p>
            </div>

            {/* Video Preview */}
            <div className="relative bg-zinc-900 rounded-lg overflow-hidden mb-6 aspect-video max-w-2xl mx-auto shadow-sm">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-500 rounded-full text-white text-sm animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  Recording
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-6 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-2.5 bg-zinc-800 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-zinc-900 transition-colors flex items-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  Stop Recording
                </button>
              )}

              {recordedBlobs.has(currentQuestion.question_id) && !isRecording && (
                <button
                  onClick={nextQuestion}
                  className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                  {currentQuestionIndex < assessment.questions.length - 1 ? (
                    <>
                      Next Question
                      <ChevronRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      Review & Submit
                      <CheckCircle className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Review Stage */}
        {stage === "review" && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-xl font-bold text-zinc-900 mb-6 text-center">
              Review Your Responses
            </h2>

            <div className="space-y-3 mb-8">
              {assessment.questions.map((q, i) => (
                <div
                  key={q.question_id}
                  className="flex items-center justify-between p-4 bg-zinc-50 shadow-sm rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-accent">{i + 1}</span>
                    </div>
                    <span className="text-sm text-zinc-700 truncate max-w-[300px]">
                      {q.question_text}
                    </span>
                  </div>
                  {recordedBlobs.has(q.question_id) ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setCurrentQuestionIndex(0);
                  setRecordedBlobs(new Map());
                  setStage("recording");
                }}
                className="bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Re-record All
              </button>
              <button
                onClick={submitAssessment}
                disabled={submitting || recordedBlobs.size !== assessment.questions.length}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Submit Assessment
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Complete Stage */}
        {stage === "complete" && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-4">
              Assessment Complete!
            </h2>
            <p className="text-zinc-500 max-w-md mx-auto">
              Thank you for completing your video assessment. Our team will review your responses
              and get back to you soon.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
