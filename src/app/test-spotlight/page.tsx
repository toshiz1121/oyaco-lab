"use client";

import { useState } from "react";
import { ExpertSpotlight } from "@/components/ExpertSpotlight";
import { AgentRole } from "@/lib/agents/types";
import { Button } from "@/components/ui/button";

export default function TestSpotlightPage() {
  const [selectedExpert, setSelectedExpert] = useState<AgentRole | undefined>(undefined);
  const [selectionReason, setSelectionReason] = useState<string | undefined>(undefined);

  const experts: AgentRole[] = ['scientist', 'biologist', 'astronomer', 'historian', 'artist', 'educator'];
  
  const reasons = {
    scientist: "「なんで空は青いの？」は光のふしぎについてのしつもんだから、りかはかせがいちばんくわしいよ！",
    biologist: "「なんで花はきれいなの？」は生き物についてのしつもんだから、せいぶつはかせがいちばんくわしいよ！",
    astronomer: "「なんで星はキラキラしているの？」は宇宙についてのしつもんだから、てんもんはかせがいちばんくわしいよ！",
    historian: "「なんで恐竜はいなくなったの？」は歴史についてのしつもんだから、れきしはかせがいちばんくわしいよ！",
    artist: "「なんで絵を描くと楽しいの？」は芸術についてのしつもんだから、げいじゅつはかせがいちばんくわしいよ！",
    educator: "「なんで勉強するの？」は学びについてのしつもんだから、きょういくはかせがいちばんくわしいよ！",
    orchestrator: "みんなのはかせをまとめて、いちばんいいこたえをみつけるよ！",
  };

  const handleSelectExpert = (expert: AgentRole) => {
    setSelectedExpert(undefined);
    setSelectionReason(undefined);
    
    setTimeout(() => {
      setSelectedExpert(expert);
      setSelectionReason(reasons[expert]);
    }, 100);
  };

  const handleReset = () => {
    setSelectedExpert(undefined);
    setSelectionReason(undefined);
  };

  return (
    <div className="min-h-screen bg-sky-50 p-4">
      {/* コントロールパネル */}
      <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-xl p-4 max-w-xs">
        <h2 className="text-lg font-bold mb-3 text-slate-800">
          🎬 スポットライトテスト
        </h2>
        
        <div className="space-y-2 mb-4">
          {experts.map((expert) => (
            <Button
              key={expert}
              onClick={() => handleSelectExpert(expert)}
              variant="outline"
              className="w-full justify-start text-sm"
              disabled={selectedExpert === expert}
            >
              {expert === 'scientist' && '🔬 りかはかせ'}
              {expert === 'biologist' && '🦋 せいぶつはかせ'}
              {expert === 'astronomer' && '🔭 てんもんはかせ'}
              {expert === 'historian' && '📚 れきしはかせ'}
              {expert === 'artist' && '🎨 げいじゅつはかせ'}
              {expert === 'educator' && '👨‍🏫 きょういくはかせ'}
            </Button>
          ))}
        </div>

        <Button
          onClick={handleReset}
          variant="destructive"
          className="w-full"
        >
          リセット
        </Button>

        <div className="mt-4 pt-4 border-t text-xs text-slate-600">
          <p className="font-semibold mb-1">現在の状態:</p>
          <p>選択: {selectedExpert || 'なし'}</p>
        </div>
      </div>

      {/* ExpertSpotlight表示エリア */}
      <div className="w-full max-w-7xl mx-auto">
        <ExpertSpotlight
          selectedExpert={selectedExpert}
          selectionReason={selectionReason}
          question="なんで空は青いの？"
          onAnimationComplete={() => {
            console.log('Animation completed!');
          }}
        />
      </div>
    </div>
  );
}
