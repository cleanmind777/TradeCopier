import React, { useState, useEffect } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/Table";
import { Trash2 } from "lucide-react";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import TradingViewWidget from "../components/trading/TradingViewWidget";

const GroupPage: React.FC = () => {
  return (
    <div className="flex bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 space-y-8">
          <div>
            <TradingViewWidget symbol={"NQZ2025"} />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default GroupPage;
