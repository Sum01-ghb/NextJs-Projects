"use server";

import { getDbConnection } from "@/lib/db";
import { generateSummaryFromGemini } from "@/lib/geminiai";
import { fetchAndExtraxtPdfText } from "@/lib/langchain";
import { formatFileNameAsTitle } from "@/utils/format-utils";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

interface PdfSummaryType {
  userId?: string;
  fileUrl: string;
  summary: string;
  title: string;
  fileName: string;
}

export async function generatePdfSummary(
  uploadResponse: [
    {
      serverData: {
        userId: string;
        file: { url: string; name: string };
      };
    }
  ]
) {
  if (!uploadResponse) {
    return { success: false, message: "File upload failed", data: null };
  }

  const {
    serverData: {
      userId,
      file: { url: pdfUrl, name: fileName },
    },
  } = uploadResponse[0];

  if (!pdfUrl) {
    return { success: false, message: "File upload failed", data: null };
  }

  try {
    const pdfText = await fetchAndExtraxtPdfText(pdfUrl);
    console.log({ pdfText });

    let summary;
    try {
      summary = await generateSummaryFromGemini(pdfText);
      console.log({ summary });
    } catch (geminiError) {
      console.error("Gemini API failed", geminiError);
      throw new Error("Failed to generate summary");
    }

    if (!summary) {
      return {
        success: false,
        message: "Failed to generate summary",
        data: null,
      };
    }

    const formattedFileName = formatFileNameAsTitle(fileName);
    return {
      success: true,
      message: "Summary generated successfully",
      data: {
        title: fileName,
        summary,
      },
    };
  } catch (err) {
    return { success: false, message: "File upload failed", data: null };
  }
}

async function savePdfSummary({
  userId,
  fileUrl,
  summary,
  title,
  fileName,
}: PdfSummaryType) {
  try {
    const sql = await getDbConnection();
    const [savedSummary] =
      await sql`INSERT INTO pdf_summaries(user_id, original_file_url, summary_text, title, file_name) VALUES (${userId} , ${fileUrl}, ${summary}, ${title}, ${fileName}) RETURNING id, summary_text`;
    return savedSummary;
  } catch (error) {
    console.error("Error saving PDF summary:", error);
    throw error;
  }
}

export async function storePdfSummaryAction({
  fileUrl,
  summary,
  title,
  fileName,
}: PdfSummaryType) {
  let savedSummary: any;
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, message: "User not found" };
    }
    savedSummary = await savePdfSummary({
      userId,
      fileUrl,
      summary,
      title,
      fileName,
    });

    if (!savedSummary) {
      return {
        success: false,
        message: "Failed to save PDF summary, please try again",
      };
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error saving PDF summary",
    };
  }
  revalidatePath(`/summaries/${savedSummary.id}`);
  return {
    success: true,
    message: "PDF summary saved successfully",
    data: { id: savedSummary.id },
  };
}
