import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import type { CareEntry } from '../../../types/liveCare';
import { CareTimelineEntry } from '../CareTimelineEntry';

const breakfast: CareEntry = {
  id: 'task-1',
  time: '上午 8:00',
  title: '早餐',
  category: 'meal',
  icon: '🍽️',
  status: 'completed',
  detail: 'Ate everything.',
  detailInChinese: '全部吃完了。',
};

const renderEntry = (entry: CareEntry): void => {
  render(
    <ul>
      <CareTimelineEntry entry={entry} isLast onOpenPhotos={vi.fn()} />
    </ul>,
  );
};

describe('a staff note on the care timeline', () => {
  afterEach(() => useConciergeStore.getState().setLocale('en'));

  it('shows a Chinese reader the translation, labelled, with the original on tap', async () => {
    useConciergeStore.getState().setLocale('zh');
    const user = userEvent.setup();
    renderEntry(breakfast);

    expect(screen.getByText('全部吃完了。')).toBeInTheDocument();
    expect(screen.getByText('自动翻译')).toBeInTheDocument();
    expect(screen.getByText('Ate everything.')).not.toBeVisible();

    await user.click(screen.getByText('查看工作人员的原文'));
    expect(screen.getByText('Ate everything.')).toBeVisible();
  });

  it('says when a note could not be translated', () => {
    useConciergeStore.getState().setLocale('zh');
    renderEntry({ ...breakfast, detailInChinese: undefined });

    expect(screen.getByText('工作人员写了一条英文备注，暂时没能翻译。')).toBeInTheDocument();
  });

  it('shows the note as written in English', () => {
    renderEntry(breakfast);

    expect(screen.getByText('Ate everything.')).toBeVisible();
    expect(screen.queryByText('全部吃完了。')).not.toBeInTheDocument();
  });
});
