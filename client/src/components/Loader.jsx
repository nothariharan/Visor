import React, { useState, useEffect } from 'react';

const frames = [
    `
    /\\_/\\
   ( o o )
    ==_==
    `,
    `
    /\\_/\\
   ( - - )
    ==_==
    `,
    `
    /\\_/\\
   ( ^ ^ )
    ==_==
    `
];

// ASCII Art for Visor
const logo = `
 ██╗   ██╗██╗███████╗ ██████╗ ██████╗ 
 ██║   ██║██║██╔════╝██╔═══██╗██╔══██╗
 ██║   ██║██║███████╗██║   ██║██████╔╝
 ╚██╗ ██╔╝██║╚════██║██║   ██║██╔══██╗
  ╚████╔╝ ██║███████║╚██████╔╝██║  ██║
   ╚═══╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝
`;

const loadingText = "INITIALIZING VISOR CORE...";

export default function Loader() {
    const [frameIndex, setFrameIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const frameInterval = setInterval(() => {
            setFrameIndex((prev) => (prev + 1) % frames.length);
        }, 300);

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) return 100;
                return prev + Math.floor(Math.random() * 10) + 5;
            });
        }, 150);

        return () => {
            clearInterval(frameInterval);
            clearInterval(progressInterval);
        };
    }, []);

    return (
        <div className="h-full w-full bg-base flex flex-col items-center justify-center font-mono text-blue animate-in fade-in duration-500">
            <pre className="text-xs md:text-sm mb-8 text-green leading-tight select-none">
                {logo}
            </pre>

            <div className="w-64 border border-surface1 p-6 rounded-lg bg-mantle shadow-2xl">
                <div className="text-xs mb-4 flex justify-between">
                    <span className="text-subtext0 font-bold">{loadingText}</span>
                    <span className="text-yellow">{Math.min(100, progress)}%</span>
                </div>

                <div className="h-2 w-full bg-crust rounded-full overflow-hidden border border-surface0 mb-6">
                    <div
                        className="h-full bg-blue transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ width: `${Math.min(100, progress)}%` }}
                    />
                </div>

                <pre className="text-sm text-yellow h-20 flex items-center justify-center select-none leading-none">
                    {frames[frameIndex]}
                </pre>

                <div className="mt-4 pt-4 border-t border-surface0">
                    <div className="text-[10px] text-subtext1 flex flex-col gap-1">
                        <div className="flex justify-between">
                            <span>{'>'} MOUNTING GRAPH...</span>
                            <span className="text-green">OK</span>
                        </div>
                        <div className="flex justify-between">
                            <span>{'>'} RESOLVING DEPS...</span>
                            <span className="text-green">{progress > 40 ? 'OK' : 'WAIT'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>{'>'} OPTIMIZING LAYOUT...</span>
                            <span className="text-green">{progress > 80 ? 'OK' : 'WAIT'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-[10px] text-surface2 animate-pulse uppercase tracking-[0.2em]">
                System Nominal // Link Established
            </div>
        </div>
    );
}
