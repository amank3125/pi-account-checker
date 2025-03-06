"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllAccounts, insertAccount, saveAccount, CONFIG } from "@/lib/db";
import { toast } from "react-hot-toast";

interface ImportExportButtonsProps {
  accountCount: number;
}

export default function ImportExportButtons({
  accountCount,
}: ImportExportButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // If import/export is disabled in config, don't render anything
  if (!CONFIG.ENABLE_ACCOUNT_IMPORT_EXPORT) {
    return null;
  }

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();

      // Check file extension to determine format
      if (file.name.toLowerCase().endsWith(".json")) {
        // Process JSON file
        await processJsonImport(text);
      } else {
        // Process CSV file (default)
        await processCsvImport(text);
      }

      // Refresh the page
      router.refresh();
    } catch (error) {
      console.error("Error importing accounts:", error);
      toast.error("Failed to import accounts");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const processCsvImport = async (text: string) => {
    const rows = text.split("\n");
    const headers = rows[0].split(",");

    // Get the indexes of the phone_number and password columns
    const phoneIndex = headers.findIndex(
      (h) => h.trim().toLowerCase() === "phone_number"
    );
    const passwordIndex = headers.findIndex(
      (h) => h.trim().toLowerCase() === "password"
    );

    if (phoneIndex === -1 || passwordIndex === -1) {
      toast.error("CSV file must contain phone_number and password columns");
      return;
    }

    // Process the data rows
    const successCount = await processRows(
      rows.slice(1),
      phoneIndex,
      passwordIndex
    );

    // Show success message
    toast.success(`Successfully imported ${successCount} accounts from CSV!`);
  };

  const processJsonImport = async (text: string) => {
    try {
      const accounts = JSON.parse(text);

      if (!Array.isArray(accounts)) {
        toast.error("JSON file must contain an array of accounts");
        return;
      }

      let successCount = 0;

      for (const account of accounts) {
        if (account.phone_number) {
          try {
            if (account.password) {
              // If it has just basic data, use insertAccount
              await insertAccount(account.phone_number, account.password);
            } else {
              // If it has full data, use saveAccount
              await saveAccount(account);
            }
            successCount++;
          } catch (error) {
            console.error(
              `Failed to import account ${account.phone_number}:`,
              error
            );
          }
        }
      }

      toast.success(
        `Successfully imported ${successCount} accounts from JSON!`
      );
    } catch (error) {
      console.error("Error parsing JSON:", error);
      toast.error("Invalid JSON format");
    }
  };

  const processRows = async (
    rows: string[],
    phoneIndex: number,
    passwordIndex: number
  ) => {
    let successCount = 0;

    for (const row of rows) {
      // Skip empty rows
      if (!row.trim()) continue;

      const columns = row.split(",");
      const phoneNumber = columns[phoneIndex]?.trim();
      const password = columns[passwordIndex]?.trim();

      if (phoneNumber && password) {
        try {
          await insertAccount(phoneNumber, password);
          successCount++;
        } catch (error) {
          console.error(`Failed to import account ${phoneNumber}:`, error);
        }
      }
    }

    return successCount;
  };

  const handleExportClick = async () => {
    setIsExporting(true);
    try {
      const accounts = await getAllAccounts();

      if (accounts.length === 0) {
        toast.error("No accounts to export");
        return;
      }

      // Create a full JSON export with all account data
      const jsonContent = JSON.stringify(accounts, null, 2);

      // Create a blob and download it
      const blob = new Blob([jsonContent], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `pi-accounts-full-${new Date().toISOString().split("T")[0]}.json`
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${accounts.length} accounts with full data!`);
    } catch (error) {
      console.error("Error exporting accounts:", error);
      toast.error("Failed to export accounts");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsvClick = async () => {
    setIsExporting(true);
    try {
      const accounts = await getAllAccounts();

      if (accounts.length === 0) {
        toast.error("No accounts to export");
        return;
      }

      // Create CSV content with basic account info
      const headers = ["phone_number", "password", "username", "added_at"];
      const csvContent = [
        headers.join(","),
        ...accounts.map((acc) => {
          return [
            acc.phone_number,
            acc.password || "",
            acc.username || "",
            acc.added_at ? new Date(acc.added_at).toISOString() : "",
          ].join(",");
        }),
      ].join("\n");

      // Create a blob and download it
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `pi-accounts-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${accounts.length} accounts to CSV!`);
    } catch (error) {
      console.error("Error exporting accounts to CSV:", error);
      toast.error("Failed to export accounts to CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex gap-3 flex-wrap">
      <button
        onClick={handleImportClick}
        disabled={isImporting}
        className="px-3 py-1 text-sm bg-white-600 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-600 hover:text-white cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isImporting ? "Importing..." : "Import CSV/JSON"}
      </button>

      {accountCount > 0 && (
        <>
          <button
            onClick={handleExportCsvClick}
            disabled={isExporting}
            className="px-3 py-1 text-sm bg-white-600 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-600 hover:text-white cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>

          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {isExporting ? "Exporting..." : "Export JSON (Full)"}
          </button>
        </>
      )}

      <input
        type="file"
        accept=".csv,.json"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
