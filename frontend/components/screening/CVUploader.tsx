"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CVUploaderProps {
  onUpload: (files: File[]) => Promise<void>;
  uploading: boolean;
}

interface FileWithStatus {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
}

export default function CVUploader({ onUpload, uploading }: CVUploaderProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    await onUpload(pendingFiles.map((f) => f.file));
    setFiles([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6">
      <h2 className="font-semibold text-zinc-900 mb-4">Upload CVs</h2>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-primary bg-accent-50"
            : "border-zinc-200 hover:border-primary/50 hover:bg-zinc-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="w-14 h-14 bg-accent-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Upload className="w-7 h-7 text-primary" />
        </div>
        {isDragActive ? (
          <p className="text-primary font-medium">Drop CVs here...</p>
        ) : (
          <>
            <p className="text-zinc-900 font-medium mb-1">Drag & drop CVs here</p>
            <p className="text-sm text-zinc-500">or click to browse. Supports PDF and DOCX files.</p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg border border-zinc-200 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 truncate max-w-[200px]">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-zinc-500">{formatFileSize(item.file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status === "pending" && (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                )}
                {item.status === "uploading" && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
                {item.status === "done" && (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                )}
              </div>
            </div>
          ))}

          <Button
            onClick={handleUpload}
            disabled={uploading || files.every((f) => f.status !== "pending")}
            loading={uploading}
            icon={!uploading ? <Upload className="w-4 h-4" /> : undefined}
            className="w-full mt-4"
          >
            {uploading ? "Processing CVs..." : `Upload & Screen ${files.filter((f) => f.status === "pending").length} CV(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}
