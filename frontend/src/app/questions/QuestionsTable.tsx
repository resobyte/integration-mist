'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/common/ToastContext';
import { apiGetPaginated, apiPost } from '@/lib/api';
import { Question, PaginationMeta, SortConfig } from '@/types';

export function QuestionsTable() {
  const { showSuccess, showDanger } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | undefined>();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'creationDate', sortOrder: 'DESC' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isAnswering, setIsAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiGetPaginated<Question>('/questions', {
        params: {
          page: currentPage,
          limit: pageSize,
          sortBy: sortConfig.sortBy,
          sortOrder: sortConfig.sortOrder,
        },
      });
      setQuestions(response.data);
      setPagination(response.meta);
    } catch {
      console.error('Failed to fetch questions');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, sortConfig]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAnswer = async (question: Question) => {
    if (answerText.trim().length < 10) {
      showDanger('Cevap en az 10 karakter olmalıdır');
      return;
    }

    if (answerText.trim().length > 2000) {
      showDanger('Cevap en fazla 2000 karakter olabilir');
      return;
    }

    setIsAnswering(question.id);
    try {
      await apiPost(`/questions/${question.id}/answer`, {
        text: answerText.trim(),
      });
      showSuccess('Cevap başarıyla gönderildi');
      setAnswerText('');
      setSelectedQuestion(null);
      fetchQuestions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Cevap gönderilirken hata oluştu';
      showDanger(errorMessage);
    } finally {
      setIsAnswering(null);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      sortBy: key,
      sortOrder: prev.sortBy === key && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC',
    }));
  };

  const formatDate = (timestamp: number | string | null) => {
    if (!timestamp) return '-';
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (isNaN(ts)) return '-';
    return new Date(ts).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      WAITING_FOR_ANSWER: 'Cevap Bekliyor',
      WAITING_FOR_APPROVE: 'Onay Bekliyor',
      ANSWERED: 'Cevaplandı',
      REPORTED: 'Raporlandı',
      REJECTED: 'Reddedildi',
    };
    return labels[status] || status;
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      WAITING_FOR_ANSWER: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      WAITING_FOR_APPROVE: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      ANSWERED: 'bg-success/10 text-success border-success/20',
      REPORTED: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  const columns = [
    { key: 'productName', label: 'Ürün' },
    { key: 'customerName', label: 'Müşteri' },
    { key: 'questionText', label: 'Soru' },
    { key: 'status', label: 'Durum' },
    { key: 'creationDate', label: 'Tarih' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Müşteri Soruları</h2>
          <p className="text-muted-foreground mt-1">Trendyol müşteri sorularını görüntüleyin ve cevaplayın.</p>
        </div>
        <button
          onClick={fetchQuestions}
          disabled={isLoading}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Yükleniyor...
            </>
          ) : (
            <>
              <svg className="w-[18px] h-[18px] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </>
          )}
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {pagination && `${pagination.total} soru bulundu`}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sayfa başına:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-sm border border-input rounded-md bg-background"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {columns.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-6 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{label}</span>
                      {sortConfig.sortBy === key && (
                        sortConfig.sortOrder === 'ASC' ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : questions.length > 0 ? (
                questions.map((question) => (
                  <tr key={question.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {question.productImageUrl && (
                          <img
                            src={question.productImageUrl}
                            alt={question.productName}
                            className="w-12 h-12 object-cover rounded border border-border"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-foreground">{question.productName}</div>
                          <div className="text-xs text-muted-foreground">{question.storeName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {question.customerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground max-w-md">
                      <div className="line-clamp-2">{question.questionText}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(question.status)}`}>
                        {getStatusLabel(question.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(question.creationDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedQuestion(question);
                            setAnswerText('');
                          }}
                          className="text-primary hover:text-primary-dark text-sm font-medium"
                        >
                          Detay
                        </button>
                        {question.status === 'WAITING_FOR_ANSWER' && (
                          <button
                            onClick={() => {
                              setSelectedQuestion(question);
                              setAnswerText('');
                            }}
                            className="text-success hover:text-success-dark text-sm font-medium"
                          >
                            Cevapla
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Henüz soru bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border bg-muted/10">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Sayfa {pagination.page} / {pagination.totalPages || 1} ({pagination.total} kayıt)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sayfa başına:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 text-sm border border-input rounded-md bg-background"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={pagination.page <= 1}
                className="px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Önceki
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedQuestion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedQuestion(null);
              setAnswerText('');
            }
          }}
        >
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-border my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-border sticky top-0 bg-card">
              <div>
                <h3 className="text-xl font-bold text-foreground">Soru Detayı</h3>
                <p className="text-sm text-muted-foreground mt-1">Ürün: {selectedQuestion.productName}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedQuestion(null);
                  setAnswerText('');
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Mağaza</label>
                  <p className="text-sm font-medium text-foreground">{selectedQuestion.storeName}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Durum</label>
                  <p className="mt-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(selectedQuestion.status)}`}>
                      {getStatusLabel(selectedQuestion.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Müşteri</label>
                  <p className="text-sm font-medium text-foreground">{selectedQuestion.customerName}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Soru Tarihi</label>
                  <p className="text-sm font-medium text-foreground">{formatDate(selectedQuestion.creationDate)}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Ürün</label>
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                  {selectedQuestion.productImageUrl && (
                    <img
                      src={selectedQuestion.productImageUrl}
                      alt={selectedQuestion.productName}
                      className="w-16 h-16 object-cover rounded border border-border"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedQuestion.productName}</p>
                    <p className="text-xs text-muted-foreground">ID: {selectedQuestion.productMainId}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Soru</label>
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedQuestion.questionText}</p>
                </div>
              </div>

              {selectedQuestion.answer && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Cevap</label>
                  <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedQuestion.answer.text}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(selectedQuestion.answer.creationDate)}
                    </p>
                  </div>
                </div>
              )}

              {selectedQuestion.rejectedAnswer && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Reddedilen Cevap</label>
                  <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedQuestion.rejectedAnswer.text}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Sebep: {selectedQuestion.rejectedAnswer.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(selectedQuestion.rejectedAnswer.creationDate)}
                    </p>
                  </div>
                </div>
              )}

              {selectedQuestion.status === 'WAITING_FOR_ANSWER' && (
                <div className="pt-4 border-t border-border">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Cevap Yaz</label>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Cevabınızı yazın (10-2000 karakter arası)"
                    className="w-full px-4 py-3 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    rows={6}
                    minLength={10}
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {answerText.length} / 2000 karakter
                    </p>
                    <button
                      onClick={() => handleAnswer(selectedQuestion)}
                      disabled={isAnswering === selectedQuestion.id || answerText.trim().length < 10 || answerText.trim().length > 2000}
                      className="px-4 py-2 text-sm font-bold text-white bg-success hover:bg-success-dark rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnswering === selectedQuestion.id ? 'Gönderiliyor...' : 'Cevabı Gönder'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

