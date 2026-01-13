"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="glass-card rounded-3xl p-6">
      <h2 className="font-bold text-slate-800 dark:text-white mb-4">Upload CVs</h2>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        {isDragActive ? (
          <p className="text-primary font-medium">Drop CVs here...</p>
        ) : (
          <>
            <p className="text-slate-800 dark:text-white font-medium mb-1">
              Drag & drop CVs here
            </p>
            <p className="text-sm text-slate-500">
              or click to browse. Supports PDF and DOCX files.
            </p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate max-w-[200px]">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-slate-500">{formatFileSize(item.file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status === "pending" && (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                )}
                {item.status === "uploading" && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
                {item.status === "done" && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </div>
            </div>
          ))}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading || files.every((f) => f.status !== "pending")}
            className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing CVs...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload & Screen {files.filter((f) => f.status === "pending").length} CV(s)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
