import { getKp } from './core.js';

/* 演示题库：每题带白名单 Tag。真实上传时由视觉模型 + 打 Tag 模型生成同样结构。 */

function tag(kpId, role = 'primary', note = '') {
  return { kp_id: Number(kpId), role, note };
}

function q(no, type, stem, user, correct, ok, opts = {}) {
  return {
    q_no: no,
    q_type: type,
    stem,
    user_answer: user,
    correct_answer: correct,
    is_correct: ok ? 1 : 0,
    score_rate: opts.score_rate ?? (ok ? 1 : 0),
    full_score: opts.full ?? (type === 'solution' ? 10 : type === 'blank' ? 5 : 4),
    difficulty: opts.diff ?? 3,
    ocr_uncertain: !!opts.uncertain,
    tags: opts.tags || []
  };
}

export function buildDemoPaperA() {
  return {
    meta: { title: '高二下 · 函数与导数单元测', examType: '单元测', examDate: '2026-09-26' },
    questions: [
      q('1-1', 'choice', '已知集合 A={0,1,2}，下列关系正确的是（ ）\nA. 0⊆A  B. 0∈A  C. {0}∈A  D. ∅∈A',
        'B', 'B', true, { tags: [tag(110101, 'primary', '元素与集合的属于关系')] }),
      q('1-2', 'blank', '若 f(x)=2x+1，则 f(3)=____。', '7', '7', true, { tags: [tag(110301)] }),
      q('1-3', 'blank', '计算：log₂16 = ____。', '4', '4', true, { tags: [tag(110409)] }),
      q('1-4', 'choice', '已知 sinα=3/5，且 α 是第二象限角，则 cosα=（ ）\nA. 4/5  B. -4/5  C. 3/4  D. -3/4',
        '-3/5', '-4/5', false, { tags: [tag(110511, 'primary', '同角关系与象限符号')] }),
      q('1-5', 'choice', '函数 y=sinx 的一条对称轴是（ ）\nA. x=0  B. x=π/4  C. x=π/2  D. x=π',
        'C', 'C', true, { tags: [tag(110517)] }),
      q('1-6', 'blank', '若 y=aˣ 是指数函数，则 a 应满足____。', 'a>0 且 a≠1', 'a>0 且 a≠1', true, { tags: [tag(110407)] }),
      q('1-7', 'blank', '等差数列 {aₙ} 中，a₁=1，d=2，则 a₅=____。', '9', '9', true, { tags: [tag(111405)] }),
      q('1-8', 'choice', '若 b 是 a 与 c 的等比中项，且 a=2，c=8，则 b=（ ）\nA. 4  B. ±4  C. 5  D. 16',
        'B', 'B', true, { tags: [tag(111410)] }),
      q('1-9', 'blank', '已知 a=(2,1)，b=(1,-2)，则 a·b=____。', '0', '0', true, { tags: [tag(110616)] }),
      q('1-10', 'choice', '直线 x+y-1=0 与圆 x²+y²=1 的位置关系是（ ）\nA. 相离  B. 相切  C. 相交  D. 无法确定',
        'C', 'C', true, { tags: [tag(111219)] }),
      q('1-11', 'solution', '求焦点在 x 轴上、a=3、b=2 的椭圆标准方程。', 'x²/9+y²/4=1', 'x²/9+y²/4=1', true, { tags: [tag(111302)] }),
      q('1-12', 'blank', '函数 f(x)=x² 在 x=1 处的瞬时变化率为____。', '3', '2', false, { tags: [tag(111501, 'primary', '导数定义与瞬时变化率')] }),
      q('1-13', 'blank', '计算：(x³)′ = ____。', '3x²', '3x²', true, { tags: [tag(111505)] }),
      q('1-14', 'blank', '从 5 人中选 3 人排成一排，共有____种排法。', '60', '60', true, { tags: [tag(111606)] }),
      q('1-15', 'blank', '(x+1)⁴ 展开式中 x² 的系数是____。', '', '6', false, { tags: [tag(111611)] }),
      q('1-16', 'choice', '关于回归直线，下列说法正确的是（ ）\nA. 一定经过原点  B. 一定经过样本中心点  C. 斜率一定为正  D. 与样本无关',
        'B', 'B', true, { tags: [tag(110910)] })
    ]
  };
}

export function buildDemoPaperB() {
  return {
    meta: { title: '高二下 · 第一次模拟 · 数学', examType: '模拟', examDate: '2026-10-12' },
    questions: [
      q('2-1', 'choice', '已知集合 A={1,2,3}，B={2,3,4}，则 A∩B=（ ）\nA. {1,2}  B. {2,3}  C. {3,4}  D. {1,4}',
        'B', 'B', true, { tags: [tag(110112)] }),
      q('2-2', 'blank', '函数 f(x)=√(x-1)/(x-2) 的定义域是____。', 'x≥1', '[1,2)∪(2,+∞)', false, { tags: [tag(110306, 'primary', '根式与分式双重限制')] }),
      q('2-3', 'solution', '判断函数 f(x)=x²-2x 在区间 [1,+∞) 上的单调性，并说明理由。',
        '在 [1,+∞) 上单调递增。因为对称轴为 x=1。', '在 [1,+∞) 上单调递增。', true, { tags: [tag(110307)] }),
      q('2-4', 'choice', '函数 y=2ˣ 的图象恒过定点（ ）\nA. (0,1)  B. (1,0)  C. (0,0)  D. (1,2)',
        'A', 'A', true, { tags: [tag(110406)] }),
      q('2-5', 'blank', '计算：log₂8 + lg100 = ____。', '4', '5', false, { tags: [tag(110412, 'primary', '对数运算性质')] }),
      q('2-6', 'choice', 'sin(π/2+α)=（ ）\nA. sinα  B. -sinα  C. cosα  D. -cosα',
        'C', 'C', true, { tags: [tag(110512)] }),
      q('2-7', 'blank', '函数 y=2sin(2x+π/6) 的最小正周期是____。', '2π', 'π', false, { tags: [tag(110518)] }),
      q('2-8', 'blank', '等差数列中 a₁=2，d=3，则 a₁₀=____。', '29', '29', true, { tags: [tag(111406)] }),
      q('2-9', 'blank', '计算：1+2+4+…+2⁹ = ____。', '1024', '1023', false, { tags: [tag(111413)] }),
      q('2-10', 'blank', '已知 a=(1,2)，b=(3,-1)，则 a·b=____。', '1', '1', true, { tags: [tag(110609)] }),
      q('2-11', 'choice', '圆 x²+y²=4 与直线 y=x+3 的位置关系是（ ）\nA. 相离  B. 相切  C. 相交  D. 无法判断',
        'C', 'A', false, { tags: [tag(111220)] }),
      q('2-12', 'blank', '椭圆 x²/9+y²/4=1 的离心率是____。', '√5/3', '√5/3', true, { tags: [tag(111303)] }),
      q('2-13', 'blank', '曲线 f(x)=x³ 在 x=1 处的切线斜率是____。', '2', '3', false, { tags: [tag(111503)] }),
      q('2-14', 'solution', '求函数 f(x)=x³-3x 的极大值。', '', '2', false, { tags: [tag(111511, 'primary', '极值点与极值')] }),
      q('2-15', 'choice', '在棱长为 1 的正方体 ABCD-A₁B₁C₁D₁ 中，向量 AB·AD=（ ）\nA. 0  B. 1  C. -1  D. 1/2',
        'A', 'A', true, { tags: [tag(111104)] }),
      q('2-16', 'blank', '5 人排成一排，甲不站两端，共有____种排法。', '72', '72', true, { tags: [tag(111605)] }),
      q('2-17', 'choice', '(x+1)⁵ 展开式中 x³ 的系数是（ ）\nA. 5  B. 10  C. 15  D. 20',
        'B', 'B', true, { tags: [tag(111610)] }),
      q('2-18', 'blank', '掷两枚骰子，点数之和为 7 的概率是____。', '1/12', '1/6', false, { tags: [tag(111004)] }),
      q('2-19', 'choice', '数据 1,2,3,4,5 的方差是（ ）\nA. 1  B. 2  C. √2  D. 3',
        'B', 'B', true, { tags: [tag(110909)] }),
      q('2-20', 'blank', '计算：(1+i)/(1-i) = ____。', '', 'i', false, { tags: [tag(110708)] }),
      q('2-21', 'solution', '证明函数 f(x)=lnx+x-2 在区间 (1,2) 内有零点。', 'f(1)=-1<0，f(2)=ln2>0，由零点存在定理得证。', 'f(1)<0，f(2)>0，故在 (1,2) 内有零点。', true, { tags: [tag(110420)] }),
      q('2-22', 'blank', '数列 {aₙ} 中 a₁=1，aₙ₊₁=2aₙ+1，则 a₃=____。', '7', '7', true, { tags: [tag(111403)] }),
      q('2-23', 'blank', '抛物线 y²=4x 的焦点坐标是____。', '(1,0)', '(1,0)', true, { tags: [tag(111310)] }),
      q('2-24', 'blank', '若 x>0，则 x+4/x 的最小值是____。', '5', '4', false, { tags: [tag(110208)] })
    ]
  };
}

export function buildDemoProfile() {
  return {
    nickname: '示例同学',
    grade: '高二',
    region: '上海徐汇',
    textbook: '人教版',
    examTarget: '高考'
  };
}

/* 三轮巩固练习：让部分知识点达到 3 次以上作答，置信度才够 0.3。
   强项连对 6 次 → 掌握度约 61；弱项连错 6 次 → 约 48。 */
const STRONG = [
  {
    kp: 110101, diff: 4,
    v: [
      ['若 A={1,2,3}，B={2,3,4}，则 A∩B=____。', '{2,3}', '{2,3}'],
      ['若 A={x|x<3}，B={x|x>1}，则 A∩B=____。', '(1,3)', '(1,3)']
    ]
  },
  {
    kp: 110301, diff: 4,
    v: [
      ['f(x)=2x+1，则 f(3)=____。', '7', '7'],
      ['f(x)=x²-1，则 f(2)=____。', '3', '3']
    ]
  },
  {
    kp: 110409, diff: 4,
    v: [
      ['log₂16=____。', '4', '4'],
      ['lg1000=____。', '3', '3']
    ]
  },
  {
    kp: 110406, diff: 4,
    v: [
      ['函数 y=2ˣ 的图象恒过定点____。', '(0,1)', '(0,1)'],
      ['函数 y=3ˣ 在 R 上是增函数还是减函数？____。', '增函数', '增函数']
    ]
  },
  {
    kp: 111406, diff: 4,
    v: [
      ['等差数列 a₁=2，d=3，则 a₁₀=____。', '29', '29'],
      ['等差数列 a₁=5，d=-2，则 a₆=____。', '-5', '-5']
    ]
  },
  {
    kp: 110616, diff: 4,
    v: [
      ['a=(1,2)，b=(3,-1)，则 a·b=____。', '1', '1'],
      ['a=(2,0)，b=(1,3)，则 a·b=____。', '2', '2']
    ]
  }
];

const WEAK = [
  {
    kp: 110306, diff: 3,
    v: [
      ['f(x)=√(x-1) 的定义域是____。', 'x>1', 'x≥1'],
      ['f(x)=1/(x-2) 的定义域是____。', 'x>2', 'x≠2']
    ]
  },
  {
    kp: 110412, diff: 3,
    v: [
      ['log₂8+lg100=____。', '4', '5'],
      ['log₃9+log₃27=____。', '6', '5']
    ]
  },
  {
    kp: 111413, diff: 3,
    v: [
      ['1+2+4+8=____。', '16', '15'],
      ['1+3+9+27=____。', '39', '40']
    ]
  },
  {
    kp: 111220, diff: 3,
    v: [
      ['圆 x²+y²=4 与直线 y=x+3 的位置关系是____。', '相交', '相离'],
      ['圆 x²+y²=1 与直线 y=x 的位置关系是____。', '相切', '相交']
    ]
  },
  {
    kp: 111503, diff: 3,
    v: [
      ['f(x)=x³ 在 x=1 处的切线斜率是____。', '2', '3'],
      ['f(x)=x² 在 x=2 处的切线斜率是____。', '3', '4']
    ]
  },
  {
    kp: 111004, diff: 3,
    v: [
      ['掷一枚骰子得到偶数的概率是____。', '1/3', '1/2'],
      ['掷两枚硬币恰有一枚正面的概率是____。', '1/4', '1/2']
    ]
  }
];

export function buildDemoDrills() {
  return Array.from({ length: 8 }, (_, i) => i + 1).map((round) => {
    const questions = [];
    const prefix = 2 + round; // 3..10
    let idx = 0;
    const push = (item, ok, vIndex) => {
      idx += 1;
      const [stem, user, correct] = item.v[vIndex];
      questions.push(q(`${prefix}-${idx}`, 'blank', stem, user, correct, ok, {
        diff: item.diff,
        tags: [tag(item.kp, 'primary', '巩固练习')]
      }));
    };
    STRONG.forEach((item) => { push(item, true, 0); push(item, true, 1); });
    WEAK.forEach((item) => { push(item, false, 0); push(item, false, 1); });
    const day = String(1 + round * 3).padStart(2, '0');
    return {
      meta: { title: `暑期巩固 · 第 ${round} 轮`, examType: '练习', examDate: `2026-07-${day}` },
      questions
    };
  });
}

export function demoStats() {
  return { kpTotal: 380, chapters: 20 };
}
