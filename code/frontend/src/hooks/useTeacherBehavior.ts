/**
 * 教师行为采集 Hook（风格学习 Layer 1）
 *
 * 采集粒度：
 * - 教案编辑：field_name, before, after, char_diff
 * - 出题编辑：question_id, field, char_diff
 * - 难度偏好：from_ratio(L1:L2:L3), to_ratio
 * - 批阅调整：ai_score, manual_score, delta
 * - 小微对话：trigger_phrase, context
 *
 * 传输方式：navigator.sendBeacon → /api/v1/analytics/style-event
 * 不阻塞主线程，不重试（丢失可接受）
 */

// ── 事件类型 ──

export type StyleEventType =
  // 教案编辑
  | 'lesson_edit_field'
  | 'lesson_delete_section'
  | 'lesson_add_section'
  | 'lesson_regenerate_section'
  | 'lesson_select_template'
  // 出题编辑
  | 'exercise_adjust_difficulty'
  | 'exercise_adjust_quantity'
  | 'exercise_replace_question'
  | 'exercise_edit_question_content'
  // 批阅操作
  | 'grading_adjust_score'
  | 'grading_edit_comment'
  // 小微对话
  | 'xiaowei_negative_feedback'
  | 'xiaowei_affirm_preference'

export interface StyleEvent {
  type: StyleEventType
  payload: Record<string, any>
  timestamp: string
}

// ── API 端点 ──
const ANALYTICS_ENDPOINT = '/api/v1/analytics/style-event'

// ── Hook ──

export function useTeacherBehavior() {
  /**
   * 采集一个风格事件
   * 使用 sendBeacon 异步发送，不阻塞主线程
   */
  const track = (type: StyleEventType, payload: Record<string, any> = {}) => {
    // 演示/试用环境跳过采集
    if (import.meta.env.DEV) return

    const event: StyleEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    }

    try {
      const blob = new Blob([JSON.stringify(event)], { type: 'application/json' })
      navigator.sendBeacon(ANALYTICS_ENDPOINT, blob)
    } catch {
      // 静默失败
    }
  }

  /**
   * 采集教案字段编辑
   * @param fieldName - 字段名（如 '教学目标'、'重难点'）
   * @param before - 编辑前内容
   * @param after - 编辑后内容
   */
  const trackLessonEdit = (fieldName: string, before: string, after: string) => {
    if (!before && !after) return
    track('lesson_edit_field', {
      field_name: fieldName,
      before_length: before.length,
      after_length: after.length,
      char_diff: after.length - before.length,
      // 不发送全文，仅发送长度和差异量保护隐私
    })
  }

  /**
   * 采集教案段落删除
   */
  const trackLessonDeleteSection = (sectionName: string, sectionLength: number) => {
    track('lesson_delete_section', {
      section_name: sectionName,
      section_length: sectionLength,
    })
  }

  /**
   * 采集教案段落新增
   */
  const trackLessonAddSection = (sectionName: string, addedVia: 'manual' | 'ai') => {
    track('lesson_add_section', {
      section_name: sectionName,
      added_via: addedVia,
    })
  }

  /**
   * 采集教案模板切换
   */
  const trackLessonSelectTemplate = (fromTemplate: string, toTemplate: string) => {
    track('lesson_select_template', {
      from_template: fromTemplate,
      to_template: toTemplate,
    })
  }

  /**
   * 采集出题难度比例调整
   */
  const trackExerciseAdjustDifficulty = (fromRatio: string, toRatio: string) => {
    track('exercise_adjust_difficulty', {
      from_ratio: fromRatio,
      to_ratio: toRatio,
    })
  }

  /**
   * 采集出题数量调整
   */
  const trackExerciseAdjustQuantity = (fromCount: number, toCount: number) => {
    track('exercise_adjust_quantity', {
      from_count: fromCount,
      to_count: toCount,
    })
  }

  /**
   * 采集题目内容编辑
   */
  const trackExerciseEditContent = (questionId: string, field: string, charDiff: number) => {
    track('exercise_edit_question_content', {
      question_id: questionId,
      field,
      char_diff: charDiff,
    })
  }

  /**
   * 采集题目替换
   */
  const trackExerciseReplaceQuestion = (questionId: string, oldDifficulty: string, reason?: string) => {
    track('exercise_replace_question', {
      question_id: questionId,
      old_difficulty: oldDifficulty,
      reason: reason || '',
    })
  }

  /**
   * 采集评分调整
   */
  const trackGradingAdjustScore = (aiScore: number, manualScore: number) => {
    track('grading_adjust_score', {
      ai_score: aiScore,
      manual_score: manualScore,
      delta: manualScore - aiScore,
    })
  }

  /**
   * 采集评语修改
   */
  const trackGradingEditComment = (charDiff: number) => {
    track('grading_edit_comment', {
      char_diff: charDiff,
    })
  }

  /**
   * 采集小微负面反馈
   */
  const trackXiaoWeiNegative = (triggerPhrase: string) => {
    track('xiaowei_negative_feedback', {
      trigger_phrase: triggerPhrase,
    })
  }

  /**
   * 采集小微偏好确认
   */
  const trackXiaoWeiAffirm = (keyPhrase: string, context: string) => {
    track('xiaowei_affirm_preference', {
      key_phrase: keyPhrase,
      context,
    })
  }

  return {
    track,
    trackLessonEdit,
    trackLessonDeleteSection,
    trackLessonAddSection,
    trackLessonSelectTemplate,
    trackExerciseAdjustDifficulty,
    trackExerciseAdjustQuantity,
    trackExerciseEditContent,
    trackExerciseReplaceQuestion,
    trackGradingAdjustScore,
    trackGradingEditComment,
    trackXiaoWeiNegative,
    trackXiaoWeiAffirm,
  }
}
