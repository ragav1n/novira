import { WaveLoader } from "@/components/ui/wave-loader";

export default function Loading() {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-md z-[9999]">
            <WaveLoader bars={5} />
        </div>
    );
}
