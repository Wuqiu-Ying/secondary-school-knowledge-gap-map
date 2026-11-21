/*
 * 学科知识点白名单模板
 * ------------------------------------------------------------
 * 复制为 src/data/kp/<subject-key>.js，然后把数组换成该学科的真实数据。
 * 推荐用 scripts/import_kp.py 从 xlsx 直接生成，避免手写。
 *
 * 字段与原来高中数学 xlsx 完全一致；subjects.js 会自动补 subject_key / stage / subject。
 * kp_id 必须使用该学科的两位段码，例如高中语文 12xxxx、初中数学 31xxxx。
 * 同一学科内 kp_id / kp_name / aliases 必须唯一。
 */
export default [
  {
    kp_id: 120101,
    kp_name: '示例知识点',
    aliases: '别名1|别名2',
    annotation: '这个知识点是什么、通常怎么考，120 字以内',
    subject: '语文',
    grade_min: 10,
    grade_max: 12,
    chapter: '示例章节',
    unit: '示例单元',
    parent_kp_id: 0,
    weight: 0.5,
    difficulty_base: 3,
    typical_mistakes: '该知识点常见错误',
    region_scope: '全国',
    status: 'active',
    search_text: '示例知识点 别名1 别名2 这个知识点是什么、通常怎么考'
  }
];
