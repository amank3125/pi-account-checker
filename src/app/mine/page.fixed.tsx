"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/layout/Sidebar";
import { getAllAccounts } from "@/lib/db";
import { IconPick } from "@tabler/icons-react";
import {
  getAllMiningDataSupabase,
  saveMiningDataSupabase,
} from "@/lib/supabase";
import { Json } from "@/types/supabase";
import MiningDataSync from "@/app/components/MiningDataSync";
import { showSuccess, showError, showInfo } from "@/lib/notifications";
import { updateExpiredMiningStatusInDB } from "@/lib/mining";

interface Account {
  phone_number: string;
  user_id: string;
  username?: string;
  display_name?: string;
  credentials?: {
    access_token: string;
  };
}
