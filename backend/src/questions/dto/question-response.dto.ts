export class QuestionResponseDto {
  id: string;
  storeId: string;
  storeName: string;
  questionId: number;
  customerId: number;
  customerName: string;
  productName: string;
  productMainId: string;
  productImageUrl: string;
  questionText: string;
  status: string;
  creationDate: number;
  answeredDateMessage: string;
  answer: {
    creationDate: number;
    text: string;
    hasPrivateInfo: boolean;
  } | null;
  rejectedAnswer: {
    creationDate: number;
    text: string;
    reason: string;
  } | null;
  rejectedDate: number | null;
  webUrl: string;
  isPublic: boolean;
  showUserName: boolean;

  static fromTrendyolQuestion(question: any, storeId: string, storeName: string): QuestionResponseDto {
    const dto = new QuestionResponseDto();
    dto.id = `${storeId}-${question.id}`;
    dto.storeId = storeId;
    dto.storeName = storeName;
    dto.questionId = question.id;
    dto.customerId = question.customerId;
    dto.customerName = question.userName || 'Anonim';
    dto.productName = question.productName;
    dto.productMainId = question.productMainId;
    dto.productImageUrl = question.imageUrl || '';
    dto.questionText = question.text;
    dto.status = question.status;
    dto.creationDate = question.creationDate;
    dto.answeredDateMessage = question.answeredDateMessage || '';
    dto.answer = question.answer
      ? {
          creationDate: question.answer.creationDate,
          text: question.answer.text,
          hasPrivateInfo: question.answer.hasPrivateInfo,
        }
      : null;
    dto.rejectedAnswer = question.rejectedAnswer
      ? {
          creationDate: question.rejectedAnswer.creationDate,
          text: question.rejectedAnswer.text,
          reason: question.rejectedAnswer.reason,
        }
      : null;
    dto.rejectedDate = question.rejectedDate || null;
    dto.webUrl = question.webUrl || '';
    dto.isPublic = question.public || false;
    dto.showUserName = question.showUserName || false;
    return dto;
  }
}

