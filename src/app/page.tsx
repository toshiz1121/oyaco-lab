"use client";

import { useState, useRef, useEffect } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { consultAction } from "@/app/actions";
import { AgentResponse } from "@/lib/agents/types";
import { agents } from "@/lib/agents/definitions";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, StopCircle, Volume2, Send } from "lucide-react";
import { Card } from "@/components/ui/card";

const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    pink: 'bg-pink-500',
    orange: 'bg-orange-500',
    gray: 'bg-gray-500'
};

export default function Home() {
  const { transcript, isListening, startListening, stopListening, resetTranscript, error: speechError } = useSpeechRecognition();
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [manualInput, setManualInput] = useState("");

  // 音声認識結果をテキスト入力に反映
  useEffect(() => {
    if (transcript) {
        setManualInput(transcript);
    }
  }, [transcript]);

  const handleMicClick = () => {
    if (isListening) {
      console.log("Stopping listening. Transcript:", transcript);
      stopListening();
      // 音声認識終了時に自動送信せず、ユーザーに確認させる形にする（あるいは手動送信ボタンを押させる）
      // しかしハッカソンデモなら自動送信の方がスムーズ。
      // ここでは manualInput を使って送信判定
      if (manualInput.trim()) {
        handleConsult(manualInput);
      } else if (transcript.trim()) {
        handleConsult(transcript);
      } else {
        console.warn("Input is empty, consult skipped.");
      }
    } else {
      console.log("Starting listening...");
      resetTranscript();
      setManualInput("");
      setResponse(null);
      startListening();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (manualInput.trim()) {
          handleConsult(manualInput);
      }
  };

  const handleConsult = async (question: string) => {
    console.log("Consulting for:", question);
    setIsLoading(true);
    try {
      const result = await consultAction(question);
      if (result.success && result.data) {
        setResponse(result.data);
        if (result.data.audioUrl) {
           playAudio(result.data.audioUrl);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (url: string) => {
    if (audio) {
      audio.pause();
    }
    const newAudio = new Audio(url);
    newAudio.onended = () => setIsPlaying(false);
    newAudio.play().catch(e => console.error("Audio playback failed", e));
    setAudio(newAudio);
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const replayAudio = () => {
      if (response?.audioUrl) {
          playAudio(response.audioUrl);
      }
  };

  const currentAgent = response ? agents[response.agentId] : null;
  const agentColorClass = currentAgent ? (colorMap[currentAgent.color] || 'bg-gray-500') : 'bg-gray-200';

  return (
    <main className="min-h-screen bg-sky-50 flex flex-col items-center justify-center p-4 font-sans">
      <h1 className="text-3xl md:text-5xl font-bold text-sky-600 mb-8 flex items-center gap-2 drop-shadow-sm">
        🧪 <span className="hidden md:inline">AI</span>夏休み子ども相談室 🔭
      </h1>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 h-auto md:h-[600px]">
        {/* 左側: 紙芝居エリア */}
        <Card className="p-4 flex flex-col items-center justify-center bg-white shadow-xl rounded-2xl border-4 border-amber-400 overflow-hidden relative min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-4xl">🤔</span>
              </div>
              <p className="text-xl text-gray-500 font-bold">先生たちと考え中...</p>
            </div>
          ) : response?.imageUrl ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
                 <img 
                    src={response.imageUrl} 
                    alt="Explanation" 
                    className="max-w-full max-h-full object-contain animate-in fade-in duration-700"
                />
            </div>
          ) : (
            <div className="text-center p-8">
               <div className="text-8xl mb-6">🏫</div>
               <p className="text-2xl text-gray-500 font-bold leading-relaxed">
                   マイクボタンを押して<br/>
                   「なんで？」を聞いてみてね！
               </p>
            </div>
          )}
        </Card>

        {/* 右側: 先生エリア */}
        <div className="flex flex-col gap-4 h-full">
            {/* エージェント表示 */}
            <Card className="flex-1 p-6 flex flex-col items-center bg-white shadow-lg rounded-2xl border-2 border-sky-200 relative overflow-hidden">
               {currentAgent ? (
                   <>
                     <div className={`absolute top-0 left-0 w-full h-6 ${agentColorClass}`}></div>
                     <div className="mt-4 relative">
                        <img 
                            src={currentAgent.avatar} 
                            alt={currentAgent.name}
                            className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover bg-gray-100"
                        />
                        <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold ${agentColorClass}`}>
                            ★
                        </div>
                     </div>
                     
                     <h2 className="text-2xl font-bold text-gray-800 mt-2">{currentAgent.nameJa}</h2>
                     <p className="text-gray-500 text-sm mb-4">{currentAgent.name}</p>
                     
                     <div className="bg-sky-50 p-6 rounded-xl w-full flex-1 overflow-y-auto border border-sky-100 shadow-inner">
                        <p className="text-lg leading-relaxed text-gray-700 font-medium">
                            {response?.text}
                        </p>
                     </div>

                     {response?.audioUrl && (
                        <div className="mt-4 flex gap-2">
                            <Button variant="outline" size="sm" onClick={replayAudio} disabled={isPlaying}>
                                <Volume2 className="h-4 w-4 mr-2" /> もう一度聞く
                            </Button>
                        </div>
                     )}
                   </>
               ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
                       <div className="flex gap-2 opacity-50">
                           <div className="w-12 h-12 rounded-full bg-gray-200"></div>
                           <div className="w-12 h-12 rounded-full bg-gray-200"></div>
                           <div className="w-12 h-12 rounded-full bg-gray-200"></div>
                       </div>
                       <p>先生たちが待機しています</p>
                   </div>
               )}
            </Card>

            {/* コントロールエリア */}
            <Card className={`p-4 bg-white shadow-lg rounded-2xl flex items-center justify-between gap-4 border-2 transition-colors ${isListening ? 'border-red-400' : 'border-transparent'}`}>
                <form onSubmit={handleTextSubmit} className="flex-1 bg-gray-100 rounded-full h-14 px-6 flex items-center overflow-hidden relative">
                    {isListening && (
                        <div className="absolute left-4 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                    )}
                    <input
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        className={`bg-transparent w-full ml-6 text-xl text-gray-600 focus:outline-none ${isListening ? 'font-bold' : ''}`}
                        placeholder={isListening ? '聞いています...' : 'ここにお話ししてね（入力もできるよ）'}
                        disabled={isListening}
                    />
                </form>

                <div className="flex gap-2">
                    {/* 手動送信ボタン（テキスト入力時用） */}
                    {!isListening && manualInput && !isLoading && (
                        <Button
                            size="icon"
                            className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg animate-in zoom-in"
                            onClick={() => handleConsult(manualInput)}
                        >
                            <Send className="h-8 w-8" />
                        </Button>
                    )}

                    {isPlaying && (
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-16 w-16 rounded-full border-2 border-red-200 hover:bg-red-50"
                            onClick={stopAudio}
                        >
                            <StopCircle className="h-8 w-8 text-red-500" />
                        </Button>
                    )}

                    <Button
                        size="icon"
                        className={`h-16 w-16 rounded-full shadow-lg transition-all duration-300 ${
                            isListening
                            ? 'bg-red-500 hover:bg-red-600 scale-110 ring-4 ring-red-200'
                            : 'bg-sky-500 hover:bg-sky-600 hover:scale-105'
                        }`}
                        onClick={handleMicClick}
                        disabled={isLoading}
                    >
                        {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                    </Button>
                </div>
            </Card>
            {speechError && (
                <p className="text-red-500 text-sm text-center">音声認識エラー: {speechError} (ブラウザの設定を確認してね)</p>
            )}
        </div>
      </div>
    </main>
  );
}
