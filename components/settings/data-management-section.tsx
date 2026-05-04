'use client';

import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    loading: boolean;
    onImport: () => void;
    onExportCSV: () => void;
    onExportPDF: () => void;
}

export function DataManagementSection({ loading, onImport, onExportCSV, onExportPDF }: Props) {
    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Download className="w-4 h-4" />
                <span>Data Management</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    onClick={onImport}
                    disabled={loading}
                    className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group col-span-2"
                >
                    <FileSpreadsheet className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">Import Bank Statement (Excel/CSV)</span>
                </Button>
                <Button
                    variant="outline"
                    onClick={onExportCSV}
                    disabled={loading}
                    className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                >
                    <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">{loading ? 'Exporting...' : 'Export CSV'}</span>
                </Button>
                <Button
                    variant="outline"
                    onClick={onExportPDF}
                    disabled={loading}
                    className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                >
                    <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">{loading ? 'Exporting...' : 'Export PDF'}</span>
                </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Import bank statements or export your expense data.</p>
        </div>
    );
}
