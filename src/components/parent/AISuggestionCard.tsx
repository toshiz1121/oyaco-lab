'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { generateConversationSuggestion } from '@/app/parent/actions';
import type { ConversationSuggestion } from '@/app/parent/actions';

interface AISuggestionCardProps {
  childId: string;
}

export function AISuggestionCard({ childId }: AISuggestionCardProps) {
  const [suggestions, setSuggestions] = useState<ConversationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchSuggestion = useCallback(async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateConversationSuggestion(childId, forceRefresh);
      if (result.error) {
        setError(result.error);
        setSuggestions([]);
      } else {
        setSuggestions(result.suggestions);
        setCached(result.cached);
      }
    } catch {
      setError('提案の取得に失敗しました');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchSuggestion(false); // 初回はキャッシュを使う
  }, [fetchSuggestion]);

  return (
    <Card className="bg-amber-50 border-amber-200">
      <CardContent className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-amber-900 text-sm">
              AIからの会話きっかけ提案
            </span>
          </div>
          {cached && !loading && (
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              キャッシュ
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-amber-200/50 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-amber-200/30 rounded animate-pulse w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-amber-800">{error}</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-3 border border-amber-100 hover:border-amber-200 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl shrink-0">{suggestion.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-amber-700">
                        {suggestion.situation}
                      </span>
                      <span className="text-xs text-amber-500">·</span>
                      <span className="text-xs text-amber-600">
                        {suggestion.topic}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {suggestion.question}
                    </p>
                    {suggestion.expectedReply && (
                      <p className="text-xs text-slate-500 mt-1.5 pl-2 border-l-2 border-slate-200 leading-relaxed">
                        🧒 {suggestion.expectedReply}
                      </p>
                    )}
                    {suggestion.followUp && (
                      <p className="text-xs text-amber-700 mt-1 pl-2 border-l-2 border-amber-200 leading-relaxed">
                        → {suggestion.followUp}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchSuggestion(true)} // 再生成時は forceRefresh=true
          disabled={loading}
          className="mt-3 text-amber-700 hover:text-amber-900 hover:bg-amber-100 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          新しい提案を見る
        </Button>
      </CardContent>
    </Card>
  );
}
