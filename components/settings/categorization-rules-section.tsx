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
    setRules: React.Dispatch<React.SetStateAction<CategorizationRule[]>>;
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

export function CategorizationRulesSection({ userId, rules, loading, buckets, setRules }: Props) {
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
        // Optimistic — realtime may or may not be enabled on the table; either
        // way the user sees the toggle land immediately.
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: next } : r));
        const { error } = await supabase
            .from('categorization_rules')
            .update({ is_active: next })
            .eq('id', rule.id);
        if (error) {
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !next } : r));
            toast.error('Failed to toggle rule');
        }
    };

    const handleDelete = async (rule: CategorizationRule) => {
        // Optimistic remove.
        const snapshot = rules;
        setRules(prev => prev.filter(r => r.id !== rule.id));
        setConfirmDelete(null);
        const { error } = await supabase
            .from('categorization_rules')
            .delete()
            .eq('id', rule.id);
        if (error) {
            setRules(snapshot);
            toast.error('Failed to delete rule');
            return;
        }
        toast.success('Rule deleted');
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
                const editingId = editing.id;
                const { data, error } = await supabase
                    .from('categorization_rules')
                    .update(payload)
                    .eq('id', editingId)
                    .select()
                    .single();
                if (error) throw error;
                // Optimistic apply with server-returned row (gets fresh updated_at).
                setRules(prev => prev.map(r => r.id === editingId ? (data as CategorizationRule) : r));
                toast.success('Rule updated');
            } else {
                const { data, error } = await supabase
                    .from('categorization_rules')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                // Insert in priority-desc order so the new row lands where the
                // realtime refetch would have placed it.
                setRules(prev => {
                    const next = [...prev, data as CategorizationRule];
                    next.sort((a, b) => {
                        if (b.priority !== a.priority) return b.priority - a.priority;
                        return b.created_at.localeCompare(a.created_at);
                    });
                    return next;
                });
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
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-5 py-4 border-b border-white/5">
                        <DialogTitle className="text-base">{editing?.id ? 'Edit rule' : 'New rule'}</DialogTitle>
                    </DialogHeader>

                    {editing && (() => {
                        const verb = editing.match_type === 'equals'
                            ? 'equals'
                            : editing.match_type === 'regex'
                                ? 'matches'
                                : 'contains';
                        const fieldLabel = editing.match_field === 'description' ? 'description' : 'place name';
                        const previewParts: string[] = [];
                        if (editing.category) previewParts.push(`set category to ${getCategoryLabel(editing.category)}`);
                        if (editing.bucket_id) {
                            const b = buckets.find(x => x.id === editing.bucket_id);
                            previewParts.push(`set bucket to ${b?.name ?? 'bucket'}`);
                        }
                        if (editing.exclude_from_allowance === true) previewParts.push('exclude from allowance');
                        if (editing.exclude_from_allowance === false) previewParts.push('include in allowance');
                        const previewReady = editing.pattern.trim().length > 0 && previewParts.length > 0;

                        // Default values when a user toggles an action on.
                        const defaultCategory = SYSTEM_CATEGORIES[0]?.id ?? 'food';
                        const defaultBucketId = buckets.find(b => !b.is_archived)?.id ?? null;

                        return (
                            <>
                                <div className="px-5 py-4 space-y-5">
                                    {/* When */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">When</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] text-muted-foreground shrink-0">the</span>
                                            <Select
                                                value={editing.match_field}
                                                onValueChange={(v) => setEditing({ ...editing, match_field: v as RuleMatchField })}
                                            >
                                                <SelectTrigger className="flex-1 h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="description">description</SelectItem>
                                                    <SelectItem value="place_name">place name</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select
                                                value={editing.match_type}
                                                onValueChange={(v) => setEditing({ ...editing, match_type: v as RuleMatchType })}
                                            >
                                                <SelectTrigger className="flex-1 h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="contains">contains</SelectItem>
                                                    <SelectItem value="equals">equals</SelectItem>
                                                    <SelectItem value="regex">matches regex</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Input
                                            value={editing.pattern}
                                            onChange={(e) => setEditing({ ...editing, pattern: e.target.value })}
                                            placeholder={editing.match_type === 'regex' ? '^uber\\b' : 'uber'}
                                            maxLength={200}
                                            className="h-9"
                                            autoFocus
                                        />
                                        <p className="text-[10px] text-muted-foreground/50">
                                            Case-insensitive · up to 200 characters
                                        </p>
                                    </div>

                                    {/* Then set — toggleable action rows */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Then</p>

                                        <ActionRow
                                            label="Set category"
                                            enabled={editing.category !== null}
                                            onToggle={(next) => setEditing({
                                                ...editing,
                                                category: next ? defaultCategory : null,
                                            })}
                                        >
                                            <Select
                                                value={editing.category ?? defaultCategory}
                                                onValueChange={(v) => setEditing({ ...editing, category: v })}
                                            >
                                                <SelectTrigger className="h-8 text-[12px] w-[150px]"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {SYSTEM_CATEGORIES.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </ActionRow>

                                        <ActionRow
                                            label="Move to bucket"
                                            enabled={editing.bucket_id !== null}
                                            onToggle={(next) => setEditing({
                                                ...editing,
                                                bucket_id: next ? defaultBucketId : null,
                                            })}
                                            disabledReason={!defaultBucketId ? 'Create a bucket first' : undefined}
                                        >
                                            <Select
                                                value={editing.bucket_id ?? ''}
                                                onValueChange={(v) => setEditing({ ...editing, bucket_id: v })}
                                            >
                                                <SelectTrigger className="h-8 text-[12px] w-[150px]"><SelectValue placeholder="Pick a bucket" /></SelectTrigger>
                                                <SelectContent>
                                                    {buckets.filter(b => !b.is_archived).map(b => (
                                                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </ActionRow>

                                        <ActionRow
                                            label="Adjust allowance"
                                            enabled={editing.exclude_from_allowance !== null}
                                            onToggle={(next) => setEditing({
                                                ...editing,
                                                exclude_from_allowance: next ? false : null,
                                            })}
                                        >
                                            <Select
                                                value={editing.exclude_from_allowance === true ? 'exclude' : 'include'}
                                                onValueChange={(v) => setEditing({
                                                    ...editing,
                                                    exclude_from_allowance: v === 'exclude',
                                                })}
                                            >
                                                <SelectTrigger className="h-8 text-[12px] w-[150px]"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="include">Include</SelectItem>
                                                    <SelectItem value="exclude">Exclude</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </ActionRow>
                                    </div>

                                    {/* Live preview */}
                                    <div className={`rounded-lg border px-3 py-2.5 text-[11.5px] leading-relaxed transition-colors ${
                                        previewReady
                                            ? 'border-primary/20 bg-primary/5 text-primary/90'
                                            : 'border-white/5 bg-secondary/5 text-muted-foreground/50 italic'
                                    }`}>
                                        {previewReady
                                            ? <>If the {fieldLabel} {verb} <span className="font-semibold">&ldquo;{editing.pattern.trim()}&rdquo;</span>, {previewParts.join(' and ')}.</>
                                            : 'Fill in a pattern and at least one action to see a preview.'}
                                    </div>

                                    {/* Priority + Active row */}
                                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="rule-priority" className="text-[11px] text-muted-foreground">Priority</Label>
                                            <Input
                                                id="rule-priority"
                                                type="number"
                                                value={editing.priority}
                                                onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) || 0 })}
                                                className="h-8 w-[64px] text-[12px] tabular-nums"
                                            />
                                            <span className="text-[10px] text-muted-foreground/60">higher wins</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="rule-active" className="text-[11px] text-muted-foreground">Active</Label>
                                            <Switch
                                                id="rule-active"
                                                checked={editing.is_active}
                                                onCheckedChange={(next) => setEditing({ ...editing, is_active: next })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="px-5 py-3 border-t border-white/5 bg-secondary/5">
                                    <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                                    <Button onClick={handleSave} disabled={saving || !previewReady}>
                                        {saving ? 'Saving…' : 'Save rule'}
                                    </Button>
                                </DialogFooter>
                            </>
                        );
                    })()}
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

interface ActionRowProps {
    label: string;
    enabled: boolean;
    onToggle: (next: boolean) => void;
    disabledReason?: string;
    children: React.ReactNode;
}

function ActionRow({ label, enabled, onToggle, disabledReason, children }: ActionRowProps) {
    return (
        <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
            enabled ? 'border-primary/15 bg-primary/5' : 'border-white/5 bg-secondary/5'
        }`}>
            <button
                type="button"
                onClick={() => !disabledReason && onToggle(!enabled)}
                disabled={!!disabledReason}
                className="flex-1 text-left disabled:opacity-50"
            >
                <p className={`text-[12.5px] font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                </p>
                {disabledReason && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{disabledReason}</p>
                )}
            </button>
            {enabled
                ? <div className="shrink-0">{children}</div>
                : (
                    <Switch
                        checked={false}
                        onCheckedChange={() => !disabledReason && onToggle(true)}
                        disabled={!!disabledReason}
                        aria-label={`Enable: ${label}`}
                    />
                )}
            {enabled && (
                <button
                    type="button"
                    onClick={() => onToggle(false)}
                    className="shrink-0 p-1 -m-1 text-muted-foreground/50 hover:text-muted-foreground"
                    aria-label={`Disable: ${label}`}
                >
                    <span className="block w-4 text-center text-base leading-none">×</span>
                </button>
            )}
        </div>
    );
}
