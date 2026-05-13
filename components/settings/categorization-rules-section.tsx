'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { CATEGORIES as SYSTEM_CATEGORIES, getCategoryLabel } from '@/lib/categories';
import type { Bucket } from '@/components/providers/buckets-provider';
import {
    type CategorizationRule, type RuleMatchField, type RuleMatchType, validateRulePattern,
} from '@/lib/categorization-rules';

interface Props {
    userId: string | null | undefined;
    rules: CategorizationRule[];
    loading: boolean;
    buckets: Bucket[];
}

type DraftRule = {
    id?: string;
    match_field: RuleMatchField;
    match_type: RuleMatchType;
    pattern: string;
    category: string | null;
    bucket_id: string | null;
    exclude_from_allowance: boolean | null;
    priority: number;
    is_active: boolean;
};

const EMPTY_DRAFT: DraftRule = {
    match_field: 'description',
    match_type: 'contains',
    pattern: '',
    category: null,
    bucket_id: null,
    exclude_from_allowance: null,
    priority: 0,
    is_active: true,
};

function describeRule(rule: CategorizationRule, buckets: Bucket[]): string {
    const where = rule.match_field === 'description' ? 'description' : 'place';
    const verb = rule.match_type === 'equals' ? 'equals' : rule.match_type === 'regex' ? 'matches' : 'contains';
    const actions: string[] = [];
    if (rule.category) actions.push(`category → ${getCategoryLabel(rule.category)}`);
    if (rule.bucket_id) {
        const b = buckets.find(x => x.id === rule.bucket_id);
        actions.push(`bucket → ${b?.name ?? 'unknown'}`);
    }
    if (rule.exclude_from_allowance === true) actions.push('exclude from allowance');
    if (rule.exclude_from_allowance === false) actions.push('count in allowance');
    return `${where} ${verb} "${rule.pattern}" → ${actions.join(', ') || '(no action)'}`;
}

export function CategorizationRulesSection({ userId, rules, loading, buckets }: Props) {
    const [editing, setEditing] = useState<DraftRule | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<CategorizationRule | null>(null);
    const [saving, setSaving] = useState(false);

    const openNew = () => setEditing({ ...EMPTY_DRAFT });
    const openEdit = (rule: CategorizationRule) => setEditing({
        id: rule.id,
        match_field: rule.match_field,
        match_type: rule.match_type,
        pattern: rule.pattern,
        category: rule.category,
        bucket_id: rule.bucket_id,
        exclude_from_allowance: rule.exclude_from_allowance,
        priority: rule.priority,
        is_active: rule.is_active,
    });

    const handleToggleActive = async (rule: CategorizationRule, next: boolean) => {
        const { error } = await supabase
            .from('categorization_rules')
            .update({ is_active: next })
            .eq('id', rule.id);
        if (error) {
            toast.error('Failed to toggle rule');
        }
    };

    const handleDelete = async (rule: CategorizationRule) => {
        const { error } = await supabase
            .from('categorization_rules')
            .delete()
            .eq('id', rule.id);
        if (error) {
            toast.error('Failed to delete rule');
            return;
        }
        toast.success('Rule deleted');
        setConfirmDelete(null);
    };

    const handleSave = async () => {
        if (!editing || !userId) return;
        const patternError = validateRulePattern(editing.match_type, editing.pattern);
        if (patternError) {
            toast.error(patternError);
            return;
        }
        if (!editing.category && !editing.bucket_id && editing.exclude_from_allowance === null) {
            toast.error('Pick at least one action (category, bucket, or allowance)');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                user_id: userId,
                match_field: editing.match_field,
                match_type: editing.match_type,
                pattern: editing.pattern.trim(),
                category: editing.category,
                bucket_id: editing.bucket_id,
                exclude_from_allowance: editing.exclude_from_allowance,
                priority: editing.priority,
                is_active: editing.is_active,
            };
            if (editing.id) {
                const { error } = await supabase
                    .from('categorization_rules')
                    .update(payload)
                    .eq('id', editing.id);
                if (error) throw error;
                toast.success('Rule updated');
            } else {
                const { error } = await supabase
                    .from('categorization_rules')
                    .insert(payload);
                if (error) throw error;
                toast.success('Rule added');
            }
            setEditing(null);
        } catch (e) {
            console.error('[CategorizationRules] save failed', e);
            toast.error('Failed to save rule');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Match a transaction&apos;s description or place name and auto-fill the
                category, bucket, or allowance flag. Applied at add time (if you haven&apos;t
                already picked) and on every imported row. Higher priority wins.
            </p>

            <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5 min-h-[48px]">
                {loading && (
                    <div className="p-4 text-center text-xs text-muted-foreground/60">Loading…</div>
                )}
                {!loading && rules.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground/60">
                        No rules yet. Add one to skip the categorize step on common merchants.
                    </div>
                )}
                {!loading && rules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between gap-3 p-3">
                        <button
                            type="button"
                            onClick={() => openEdit(rule)}
                            className="flex-1 min-w-0 text-left"
                        >
                            <p className={`text-[13px] font-medium truncate ${rule.is_active ? '' : 'opacity-50 line-through'}`}>
                                {describeRule(rule, buckets)}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground/60 mt-0.5">
                                Priority {rule.priority}
                            </p>
                        </button>
                        <Switch
                            checked={rule.is_active}
                            onCheckedChange={(next) => handleToggleActive(rule, next)}
                            aria-label={`${rule.is_active ? 'Disable' : 'Enable'} rule`}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(rule)}
                            aria-label="Edit rule"
                        >
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDelete(rule)}
                            aria-label="Delete rule"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <Button onClick={openNew} variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add rule
            </Button>

            <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Edit rule' : 'New rule'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">When</Label>
                                    <Select
                                        value={editing.match_field}
                                        onValueChange={(v) => setEditing({ ...editing, match_field: v as RuleMatchField })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="description">Description</SelectItem>
                                            <SelectItem value="place_name">Place name</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">Match</Label>
                                    <Select
                                        value={editing.match_type}
                                        onValueChange={(v) => setEditing({ ...editing, match_type: v as RuleMatchType })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="contains">Contains</SelectItem>
                                            <SelectItem value="equals">Equals</SelectItem>
                                            <SelectItem value="regex">Regex</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs">Pattern</Label>
                                <Input
                                    value={editing.pattern}
                                    onChange={(e) => setEditing({ ...editing, pattern: e.target.value })}
                                    placeholder={editing.match_type === 'regex' ? '^uber\\b' : 'uber'}
                                    maxLength={200}
                                />
                                <p className="text-[10px] text-muted-foreground/60 mt-1">Case-insensitive.</p>
                            </div>

                            <div className="border-t border-white/5 pt-3 space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground">Then set</p>

                                <div>
                                    <Label className="text-xs">Category (optional)</Label>
                                    <Select
                                        value={editing.category ?? '__none__'}
                                        onValueChange={(v) => setEditing({ ...editing, category: v === '__none__' ? null : v })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">No change</SelectItem>
                                            {SYSTEM_CATEGORIES.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="text-xs">Bucket (optional)</Label>
                                    <Select
                                        value={editing.bucket_id ?? '__none__'}
                                        onValueChange={(v) => setEditing({ ...editing, bucket_id: v === '__none__' ? null : v })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">No change</SelectItem>
                                            {buckets.filter(b => !b.is_archived).map(b => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="text-xs">Allowance (optional)</Label>
                                    <Select
                                        value={editing.exclude_from_allowance === null ? '__none__' : editing.exclude_from_allowance ? 'exclude' : 'include'}
                                        onValueChange={(v) => setEditing({
                                            ...editing,
                                            exclude_from_allowance: v === '__none__' ? null : v === 'exclude',
                                        })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">No change</SelectItem>
                                            <SelectItem value="include">Count in allowance</SelectItem>
                                            <SelectItem value="exclude">Exclude from allowance</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                                <div>
                                    <Label className="text-xs">Priority</Label>
                                    <Input
                                        type="number"
                                        value={editing.priority}
                                        onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <Label className="text-xs">Active</Label>
                                    <div className="flex items-center h-9 mt-0">
                                        <Switch
                                            checked={editing.is_active}
                                            onCheckedChange={(next) => setEditing({ ...editing, is_active: next })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
                        <AlertDialogDescription>
                            New transactions matching this pattern will no longer be auto-categorized.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmDelete && handleDelete(confirmDelete)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
