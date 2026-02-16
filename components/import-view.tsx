'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parse, isValid, format } from 'date-fns';
import { Upload, ChevronRight, Check, AlertCircle, X, ArrowLeft, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type ImportStep = 'upload' | 'map' | 'review';

interface CSVRow {
    [key: string]: string;
}

interface ColumnMapping {
    date: string;
    description: string;
    amount?: string;
    debit?: string;
    credit?: string;
    category?: string;
}

interface ParsedTransaction {
    date: Date;
    description: string;
    amount: number;
    category: string;
    isValid: boolean;
    error?: string;
    originalRow: any;
    paymentMethod: string;
}

export function ImportView() {
    const router = useRouter();
    const { userId } = useUserPreferences();
    const [step, setStep] = useState<ImportStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[][]>([]); // Raw data rows
    const [headerRowIndex, setHeaderRowIndex] = useState(0);

    const [mapping, setMapping] = useState<ColumnMapping>({
        date: '',
        description: '',
        amount: '',
        debit: '',
        credit: '',
        category: ''
    });

    // Mode for Amount mapping: 'single' (Amount column) or 'split' (Debit/Credit columns)
    const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');

    const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
    const [isImporting, setIsImporting] = useState(false);

    // Categories for mapping/fallback
    const CATEGORIES = [
        'Food', 'Transport', 'Bills', 'Shopping', 'Healthcare', 'Entertainment', 'Others', 'Uncategorized'
    ];

    const findHeaderRow = (data: any[][]): { index: number, headers: string[] } => {
        // Look for common header keywords in first 1000 rows (some banks have huge headers)
        // Added 'txn date', 'value date', 'ref no./cheque no.' for SBI
        const keywords = ['date', 'time', 'description', 'particulars', 'narration', 'amount', 'debit', 'credit', 'balance', 'withdraw', 'deposit', 'value', 'txn date', 'ref no', 'cheque no'];

        for (let i = 0; i < Math.min(data.length, 1000); i++) {
            const row = data[i];
            if (!row || !Array.isArray(row)) continue;

            // Convert row to string logic for checking
            const rowStr = row.map(cell => String(cell).toLowerCase()).join(' ');

            // Check if row contains reasonable number of keywords
            let matchCount = 0;
            keywords.forEach(kw => {
                if (rowStr.includes(kw)) matchCount++;
            });

            // If we found 2+ keywords, this is likely the header row
            if (matchCount >= 2) {
                // Ensure headers are unique and non-empty
                const headers = row.map((cell, idx) => {
                    const val = String(cell).trim();
                    return val || `__EMPTY_${idx}`;
                });
                return { index: i, headers };
            }
        }

        // Fallback to first row
        if (data.length > 0) {
            const headers = data[0].map((cell: any, idx: number) => {
                const val = String(cell).trim();
                return val || `__EMPTY_${idx}`;
            });
            return { index: 0, headers };
        }

        return { index: 0, headers: [] };
    };

    const processData = (rawData: any[][]) => {
        const { index, headers } = findHeaderRow(rawData);

        setHeaderRowIndex(index);
        setHeaders(headers);
        setOriginalData(rawData);

        // Auto-detect columns based on detected headers
        const lowerHeaders = headers.map(h => h.toLowerCase());
        const newMapping = { ...mapping };

        // Date
        const dateIdx = lowerHeaders.findIndex(h => h.includes('date') || h.includes('time'));
        if (dateIdx >= 0) newMapping.date = headers[dateIdx];

        // Description
        const descIdx = lowerHeaders.findIndex(h => h.includes('desc') || h.includes('particular') || h.includes('narrat') || h.includes('detail'));
        if (descIdx >= 0) newMapping.description = headers[descIdx];

        // Amount logic
        const amtIdx = lowerHeaders.findIndex(h => h.includes('amount') || (h.includes('amt') && !h.includes('withdraw') && !h.includes('deposit')));
        const debitIdx = lowerHeaders.findIndex(h => h.includes('debit') || h.includes('withdraw') || h === 'dr');
        const creditIdx = lowerHeaders.findIndex(h => h.includes('credit') || h.includes('deposit') || h === 'cr');

        if (debitIdx >= 0 || creditIdx >= 0) {
            setAmountMode('split');
            if (debitIdx >= 0) newMapping.debit = headers[debitIdx];
            if (creditIdx >= 0) newMapping.credit = headers[creditIdx];
        } else if (amtIdx >= 0) {
            setAmountMode('single');
            newMapping.amount = headers[amtIdx];
        }

        const catIdx = lowerHeaders.findIndex(h => h.includes('cat'));
        if (catIdx >= 0) newMapping.category = headers[catIdx];

        setMapping(newMapping);
        setStep('map');
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            setFile(file);
            const fileExt = file.name.split('.').pop()?.toLowerCase();

            if (fileExt === 'csv') {
                Papa.parse(file, {
                    header: false, // We handle headers manually now
                    skipEmptyLines: true,
                    complete: (results) => {
                        processData(results.data as any[][]);
                    },
                    error: (error) => {
                        toast.error(`Error parsing CSV: ${error.message}`);
                    }
                });
            } else if (fileExt === 'xlsx' || fileExt === 'xls') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = e.target?.result;
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const sheetName = workbook.SheetNames[0];
                        const sheet = workbook.Sheets[sheetName];
                        // Get raw array of arrays
                        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as any[][];

                        if (jsonData.length > 0) {
                            processData(jsonData);
                        } else {
                            toast.error('Excel file appears to be empty.');
                        }
                    } catch (error: any) {
                        toast.error(`Error parsing Excel: ${error.message}`);
                    }
                };
                reader.readAsBinaryString(file);
            } else {
                toast.error('Unsupported file type. Please upload CSV or Excel.');
            }
        }
    }, [mapping]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
        },
        maxFiles: 1
    });

    const handleMapColumns = () => {
        // Validation based on mode
        if (!mapping.date || !mapping.description) {
            toast.error('Please map at least Date and Description columns.');
            return;
        }
        if (amountMode === 'single' && !mapping.amount) {
            toast.error('Please map the Amount column.');
            return;
        }
        if (amountMode === 'split' && (!mapping.debit && !mapping.credit)) {
            toast.error('Please map at least one Amount column (Debit or Credit).');
            return;
        }

        // Process data starting from headerRowIndex + 1
        const dataRows = originalData.slice(headerRowIndex + 1);

        // Helper to find value by column name
        const getValue = (row: any[], colName: string) => {
            if (!colName) return undefined;
            const colIdx = headers.indexOf(colName);
            if (colIdx === -1) return undefined;
            return row[colIdx];
        };

        const parsed = dataRows.map((row) => {
            // Skip empty rows
            if (!row || row.length === 0 || row.every((c: any) => !c)) return null;

            const dateStr = getValue(row, mapping.date);
            const descStr = getValue(row, mapping.description);
            const catStr = getValue(row, mapping.category || '');

            if (!dateStr && !descStr) return null; // Skip likely empty rows

            // AMOUNT LOGIC
            let amount = 0;
            if (amountMode === 'single') {
                const val = getValue(row, mapping.amount || '');
                const clean = val ? String(val).replace(/[^0-9.-]/g, '') : '0';
                amount = parseFloat(clean);
            } else {
                // Split mode
                const debitVal = getValue(row, mapping.debit || '');
                const creditVal = getValue(row, mapping.credit || '');

                const debit = debitVal ? parseFloat(String(debitVal).replace(/[^0-9.-]/g, '')) : 0;
                const credit = creditVal ? parseFloat(String(creditVal).replace(/[^0-9.-]/g, '')) : 0;

                // Assumption: Debit is expense (positive in our DB logic for import checks but typically negative flow), Credit is income (negative expense? or positive income?)
                // Novira model: Positive amount = Expense. Negative amount = Income (or settlement).
                // Usually bank statement: Debit = money leaving (Expense), Credit = money entering (Income).
                // So Net Amount = Debit - Credit. 
                // E.g. Debit $100 -> Amount 100. Credit $100 -> Amount -100.
                amount = (isNaN(debit) ? 0 : debit) - (isNaN(credit) ? 0 : credit);
            }

            // DATE LOGIC
            let date: Date | undefined;
            // Basic date parsing - improve with more formats if needed
            // Try common formats
            const formats = [
                'dd/MM/yy', 'MM/dd/yy', 'yy-MM-dd', 'yy/MM/dd', 'dd-MM-yy',
                'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy', 'yyyy/MM/dd',
                'dd-MMM-yyyy', 'dd/MMM/yyyy', 'd-MMM-yy', 'dd-MMM-yy', 'd-MMM-yyyy'
            ];
            // Normalize separators
            const normDateStr = String(dateStr).trim();
            for (const fmt of formats) {
                const d = parse(normDateStr, fmt, new Date());
                if (isValid(d)) {
                    date = d;
                    // Correct 2-digit years that might have been parsed as 00xx
                    if (date.getFullYear() < 100) {
                        date.setFullYear(date.getFullYear() + 2000);
                    }
                    else if (date.getFullYear() < 1970) {
                        // Some 2-digit years might parse to 19xx if using Date.parse, but here we use date-fns.
                        // However, just be safe: if it's oddly low (like 0026), fix it.
                        // Actually, date-fns 'yy' handles this based on reference date (usually +/- 50 years).
                        // But if 'yyyy' matched '26', it would be 0026.
                        // The loop tries formats in order.
                    }
                    break;
                }
            }
            if (!date) {
                const d = new Date(normDateStr);
                if (isValid(d)) {
                    date = d;
                    if (date.getFullYear() < 100) {
                        date.setFullYear(date.getFullYear() + 2000);
                    }
                }
            }

            // CATEGORY LOGIC
            let category = 'Uncategorized';
            if (catStr) {
                const match = CATEGORIES.find(c => c.toLowerCase() === String(catStr).toLowerCase());
                if (match) category = match;
            } else {
                const lowerDesc = String(descStr).toLowerCase();
                if (lowerDesc.includes('uber') || lowerDesc.includes('taxi') || lowerDesc.includes('fuel')) category = 'Transport';
                else if (lowerDesc.includes('zomato') || lowerDesc.includes('swiggy') || lowerDesc.includes('restaurant') || lowerDesc.includes('cafe')) category = 'Food';
                else if (lowerDesc.includes('supermarket') || lowerDesc.includes('grocery') || lowerDesc.includes('mart')) category = 'Shopping';
                else if (lowerDesc.includes('netflix') || lowerDesc.includes('spotify') || lowerDesc.includes('movie') || lowerDesc.includes('cinema')) category = 'Entertainment';
                else if (lowerDesc.includes('pharmacy') || lowerDesc.includes('doctor') || lowerDesc.includes('hospital')) category = 'Healthcare';
                else if (lowerDesc.includes('bill') || lowerDesc.includes('rent') || lowerDesc.includes('electricity') || lowerDesc.includes('recharge')) category = 'Bills';
            }

            // PAYMENT METHOD LOGIC
            let paymentMethod = 'Bank Transfer';
            const lowerDescForMethod = String(descStr).toLowerCase();
            if (lowerDescForMethod.includes('upi') || lowerDescForMethod.includes('upi/dr') || lowerDescForMethod.includes('upi/cr')) {
                paymentMethod = 'UPI';
            } else if (lowerDescForMethod.includes('debit card') || lowerDescForMethod.includes('pos') || lowerDescForMethod.includes('atm')) {
                paymentMethod = 'Debit Card';
            } else if (lowerDescForMethod.includes('credit card')) {
                paymentMethod = 'Credit Card';
            } else if (lowerDescForMethod.includes('neft') || lowerDescForMethod.includes('rtgs') || lowerDescForMethod.includes('imps') || lowerDescForMethod.includes('transfer')) {
                paymentMethod = 'Bank Transfer';
            }

            return {
                date: date || new Date(),
                description: descStr || 'Unknown Transaction',
                amount: isNaN(amount) ? 0 : amount,
                category,
                paymentMethod,
                isValid: !!date && !isNaN(amount) && !!descStr,
                error: !date ? 'Invalid Date' : isNaN(amount) ? 'Invalid Amount' : !descStr ? 'Missing Description' : undefined,
                originalRow: row
            };
        }).filter(Boolean) as ParsedTransaction[];

        setParsedTransactions(parsed);
        setStep('review');
    };

    const handleImport = async () => {
        if (!userId) {
            toast.error('You must be logged in to import.');
            return;
        }

        setIsImporting(true);
        const validTransactions = parsedTransactions.filter(t => t.isValid);

        if (validTransactions.length === 0) {
            toast.error('No valid transactions to import.');
            setIsImporting(false);
            return;
        }

        try {
            const records = validTransactions.map(t => ({
                user_id: userId,
                date: format(t.date, 'yyyy-MM-dd'),
                description: t.description,
                amount: t.amount, // Positive for expense, negative for income
                category: t.category,
                currency: 'INR',
                payment_method: t.paymentMethod,
                created_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('transactions').insert(records);

            if (error) throw error;

            toast.success(`Successfully imported ${validTransactions.length} transactions!`);
            router.push('/');
        } catch (error: any) {
            toast.error(`Import failed: ${error.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="p-5 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Import Transactions</h1>
                    <p className="text-sm text-muted-foreground">Upload your bank statement (CSV or Excel)</p>
                </div>
            </div>

            {/* Steps Indicator */}
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className={step === 'upload' ? 'text-primary' : ''}>1. Upload</span>
                <ChevronRight className="w-4 h-4" />
                <span className={step === 'map' ? 'text-primary' : ''}>2. Map Columns</span>
                <ChevronRight className="w-4 h-4" />
                <span className={step === 'review' ? 'text-primary' : ''}>3. Review</span>
            </div>

            {step === 'upload' && (
                <Card className="border-dashed border-2 bg-secondary/5">
                    <CardContent className="pt-6">
                        <div
                            {...getRootProps()}
                            className={`flex flex-col items-center justify-center p-10 cursor-pointer transition-colors rounded-xl ${isDragActive ? 'bg-primary/10' : 'hover:bg-secondary/20'}`}
                        >
                            <input {...getInputProps()} />
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <Upload className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">Upload File</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-xs">
                                Drag and drop your bank statement here, or click to browse.
                            </p>
                            <div className="mt-6 flex gap-2">
                                <Button variant="secondary" onClick={(e) => {
                                    e.stopPropagation();
                                    open();
                                }}>
                                    Select File
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 'map' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Map Columns</CardTitle>
                        <CardDescription>Match your file columns to Novira fields.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Header Row Info */}
                        <div className="bg-secondary/20 p-3 rounded-lg text-sm text-muted-foreground">
                            Detected Header Row: <strong>Row {headerRowIndex + 1}</strong>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Date Column <span className="text-rose-500">*</span></label>
                                <Select value={mapping.date} onValueChange={(val) => setMapping({ ...mapping, date: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                    <SelectContent>
                                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description Column <span className="text-rose-500">*</span></label>
                                <Select value={mapping.description} onValueChange={(val) => setMapping({ ...mapping, description: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                    <SelectContent>
                                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="amount-mode" className="text-sm font-medium">Amount Mapping Mode</Label>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${amountMode === 'single' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>Single Column</span>
                                    <Switch
                                        id="amount-mode"
                                        checked={amountMode === 'split'}
                                        onCheckedChange={(checked) => setAmountMode(checked ? 'split' : 'single')}
                                    />
                                    <span className={`text-xs ${amountMode === 'split' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>Split (Debit/Credit)</span>
                                </div>
                            </div>

                            {amountMode === 'single' ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Amount Column <span className="text-rose-500">*</span></label>
                                    <Select value={mapping.amount} onValueChange={(val) => setMapping({ ...mapping, amount: val })}>
                                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                        <SelectContent>
                                            {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Debit / Withdrawal</label>
                                        <Select value={mapping.debit || "none"} onValueChange={(val) => setMapping({ ...mapping, debit: val === "none" ? "" : val })}>
                                            <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">-- Skip --</SelectItem>
                                                {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Credit / Deposit</label>
                                        <Select value={mapping.credit || "none"} onValueChange={(val) => setMapping({ ...mapping, credit: val === "none" ? "" : val })}>
                                            <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">-- Skip --</SelectItem>
                                                {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Category Column (Optional)</label>
                            <Select value={mapping.category || ''} onValueChange={(val) => setMapping({ ...mapping, category: val })}>
                                <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Auto Categorize --</SelectItem>
                                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="pt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                            <Button onClick={handleMapColumns}>Preview &rarr;</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 'review' && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Review Transactions</CardTitle>
                            <CardDescription>
                                Found {parsedTransactions.length} items. {parsedTransactions.filter(t => !t.isValid).length} errors.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedTransactions.map((tx, idx) => (
                                            <TableRow key={idx} className={!tx.isValid ? 'bg-rose-500/5' : ''}>
                                                <TableCell>
                                                    {tx.isValid ? (
                                                        <Check className="w-4 h-4 text-emerald-500" />
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-rose-500 font-medium text-xs">
                                                            <AlertCircle className="w-4 h-4" />
                                                            {tx.error}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>{isValid(tx.date) ? format(tx.date, 'MMM d, yyyy') : 'Invalid'}</TableCell>
                                                <TableCell className="font-medium max-w-[200px] truncate" title={tx.description}>
                                                    {tx.description}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="px-2 py-1 rounded bg-secondary text-xs">
                                                        {tx.category}
                                                    </span>
                                                </TableCell>
                                                <TableCell className={`text-right font-mono ${tx.amount < 0 ? 'text-emerald-500' : ''}`}>
                                                    {tx.amount.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-2 pb-10">
                        <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
                        <Button
                            onClick={handleImport}
                            disabled={isImporting || parsedTransactions.filter(t => t.isValid).length === 0}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                            {isImporting ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</>
                            ) : (
                                <><FileSpreadsheet className="w-4 h-4 mr-2" /> Import {parsedTransactions.filter(t => t.isValid).length} Transactions</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
