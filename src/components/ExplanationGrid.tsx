import React from 'react';

interface ExplanationGridProps {
  imageUrl?: string;
  totalSteps: number;
  currentStepIndex: number; // -1 if not started? or 0 based
}

export function ExplanationGrid({ imageUrl, totalSteps, currentStepIndex }: ExplanationGridProps) {
  if (!imageUrl) {
    // Placeholder while loading or if failed
    return (
      <div className="w-full aspect-[4/3] bg-gray-100 rounded-3xl animate-pulse flex items-center justify-center text-gray-300">
        Generating illustration...
      </div>
    );
  }

  // Generate array for grid items
  // If totalSteps is less than 4, we might still want to fill the grid or center it?
  // The layout logic in AgentChatInterface handled 1, 2, and 4.
  // Let's adapt that logic.
  
  // We'll create a container that maintains aspect ratio.
  // Inside, we render the 'panels'.
  
  const renderPanels = () => {
    const panels = [];
    const panelCount = totalSteps <= 1 ? 1 : totalSteps === 2 ? 2 : 4;

    for (let i = 0; i < panelCount; i++) {
      const isActive = i === currentStepIndex;
      const isPast = i < currentStepIndex;
      
      // Determine style for cropping the large image
      const style = getPanelStyle(panelCount, i);

      panels.push(
        <div 
          key={i} 
          className={`relative overflow-hidden bg-white border-4 rounded-2xl transition-all duration-500 ease-in-out ${
             isActive 
               ? "border-sky-500 shadow-xl z-10 scale-[1.02] opacity-100" 
               : isPast 
                 ? "border-sky-100 opacity-80" 
                 : "border-gray-100 opacity-40"
          }`}
        >
           {/* The Image Part */}
           <div className="absolute inset-0 w-full h-full">
             <img 
               src={imageUrl} 
               alt={`Step ${i + 1}`}
               style={style}
               className="max-w-none" 
             />
           </div>

           {/* Badge number */}
           <div className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-md transition-colors ${
             isActive ? "bg-sky-500" : "bg-gray-300"
           }`}>
             {i + 1}
           </div>
        </div>
      );
    }
    return panels;
  };

  // Grid Layout Container
  let gridClass = "";
  if (totalSteps <= 1) gridClass = "grid-cols-1 grid-rows-1";
  else if (totalSteps === 2) gridClass = "grid-cols-2 grid-rows-1";
  else gridClass = "grid-cols-2 grid-rows-2";

  return (
    <div className={`grid ${gridClass} gap-4 w-full h-full p-4`}>
      {renderPanels()}
    </div>
  );
}

// Helper (copied/adapted from AgentChatInterface)
const getPanelStyle = (totalSteps: number, stepIndex: number): React.CSSProperties => {
  if (totalSteps <= 1) return { width: '100%', height: '100%', objectFit: 'cover' };
  
  if (totalSteps === 2) {
    return {
        width: '200%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: stepIndex === 0 ? '0%' : '-100%',
        objectFit: 'cover'
    };
  }

  // 4 Panels (default for 3 or 4)
  const row = Math.floor(stepIndex / 2); // 0 or 1
  const col = stepIndex % 2; // 0 or 1
  
  return {
      width: '200%',
      height: '200%',
      position: 'absolute',
      top: row === 0 ? '0%' : '-100%',
      left: col === 0 ? '0%' : '-100%',
      objectFit: 'cover'
  };
};
