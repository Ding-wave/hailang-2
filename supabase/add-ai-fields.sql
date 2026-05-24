alter table public.articles
  add column if not exists deep_analysis_zh text,
  add column if not exists investment_advice_zh text;

update public.articles
set
  deep_analysis_zh = coalesce(deep_analysis_zh, summary_zh),
  investment_advice_zh = coalesce(
    investment_advice_zh,
    '1. 暂无投资建议。' || E'\n' ||
    '2. 请结合更多信息后再做决策。' || E'\n' ||
    '3. 投资有风险，入市需谨慎。'
  )
where deep_analysis_zh is null or investment_advice_zh is null;
