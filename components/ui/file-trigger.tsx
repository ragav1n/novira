"use client"

import React from "react"
import { FileTrigger } from "react-aria-components"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/aria-button"
import { cn } from "@/lib/utils"

interface FileTriggerButtonProps {
    onSelect: (file: File) => void;
    currentAvatarUrl?: string | null;
    className?: string;
}

export function FileTriggerButton({ onSelect, className }: FileTriggerButtonProps) {
    return (
        <FileTrigger
            acceptedFileTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/webp']}
            onSelect={(files) => {
                if (!files) return
                const list = Array.from(files)
                if (list.length > 0) {
                    onSelect(list[0])
                }
            }}
        >
            <Button
                variant="secondary"
                size="icon"
                className={cn("rounded-full w-6 h-6 shadow-md border-2 border-background", className)}
            >
                <Pencil className="w-3 h-3" />
                <span className="sr-only">Change Avatar</span>
            </Button>
        </FileTrigger>
    )
}
