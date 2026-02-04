'use client';

interface DeleteRecurringModalProps {
  onCancel: () => void;
  onDeleteThis: () => void;
  onDeleteAll: () => void;
}

export default function DeleteRecurringModal({
  onCancel,
  onDeleteThis,
  onDeleteAll,
}: DeleteRecurringModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      {/* 모달 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="bg-red-50 px-6 py-4 border-b border-red-200">
          <h2 className="text-xl font-bold text-red-900">Delete Recurring Transaction</h2>
          <p className="text-sm text-red-700 mt-1">
            This is a recurring transaction. Choose an option:
          </p>
        </div>

        {/* 옵션 버튼들 */}
        <div className="p-6 space-y-3">
          {/* 이 거래만 삭제 */}
          <button
            onClick={onDeleteThis}
            className="w-full px-4 py-3 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 transition font-medium text-left border border-orange-300"
          >
            <div className="font-semibold">Delete this occurrence only</div>
            <div className="text-sm text-orange-700 mt-1">
              Only delete this single transaction
            </div>
          </button>

          {/* 모든 recurring 거래 삭제 */}
          <button
            onClick={onDeleteAll}
            className="w-full px-4 py-3 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition font-medium text-left border border-red-300"
          >
            <div className="font-semibold">Delete all recurring instances</div>
            <div className="text-sm text-red-700 mt-1">
              Delete all related recurring transactions (current and future)
            </div>
          </button>

          {/* 취소 */}
          <button
            onClick={onCancel}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium border border-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
