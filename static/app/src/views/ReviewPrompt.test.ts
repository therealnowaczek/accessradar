import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en';

vi.mock('@forge/bridge', () => ({ router: { open: vi.fn() }, invoke: vi.fn() }));
vi.mock('../api', () => ({ call: vi.fn(), errorText: String }));
vi.mock('../Toast', () => ({ useToast: () => ({}) }));
vi.mock('@atlaskit/section-message', () => ({
  default: () => null,
  SectionMessageAction: () => null,
}));
vi.mock('@atlaskit/primitives', () => ({ Text: () => null }));

import { ReviewPromptMessage } from './ReviewPrompt';

const URL_ =
  'https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira?tab=reviews&hosting=cloud';

type Props = Record<string, any>;
const setup = () => {
  const answers: string[] = [];
  const opened: string[] = [];
  const root = ReviewPromptMessage({
    url: URL_,
    onAnswer: (a) => answers.push(a),
    open: (u) => opened.push(u),
  }) as ReactElement<Props>;
  const actions = root.props.actions as ReactElement<Props>[];
  return { root, actions, answers, opened };
};
const text = (n: ReactNode): string =>
  isValidElement<Props>(n)
    ? text(n.props.children)
    : Array.isArray(n)
      ? n.map(text).join('')
      : String(n ?? '');

describe('ReviewPromptMessage', () => {
  it('has the standard EN copy', () => {
    expect(en['reviewPrompt.title']).toBe('Enjoying {appName}?');
    expect(en['reviewPrompt.body']).toBe(
      'A short review on the Atlassian Marketplace helps other teams find it. It takes about a minute, and nothing in {appName} depends on it.',
    );
    expect(en['reviewPrompt.open']).toBe('Write a review');
    expect(en['reviewPrompt.alreadyDone']).toBe('I already reviewed');
    expect(en['reviewPrompt.dismiss']).toBe('Not now');
  });
  it('is one discovery h2 message with the app name in title and body, and no X', () => {
    const { root } = setup();
    expect(root.props.appearance).toBe('discovery');
    expect(root.props.headingLevel).toBe('h2');
    expect(root.props.isDismissible).toBeUndefined();
    expect(root.props.title).toBe('Enjoying AccessRadar?');
    expect(text(root.props.children)).toBe(
      'A short review on the Atlassian Marketplace helps other teams find it. It takes about a minute, and nothing in AccessRadar depends on it.',
    );
  });
  it('has exactly three labelled actions and no link in the body', () => {
    const { root, actions } = setup();
    expect(actions.map((a) => text(a.props.children))).toEqual([
      'Write a review',
      'I already reviewed',
      'Not now',
    ]);
    const body = root.props.children as ReactElement<Props>;
    expect(typeof body.props.children).toBe('string');
    expect(body.props.href).toBeUndefined();
  });
  it('Write a review opens the exact URL, prevents default and stores done', () => {
    const { actions, answers, opened } = setup();
    expect(actions[0].props.href).toBe(URL_);
    expect(URL_).not.toContain('utm_');
    const preventDefault = vi.fn();
    actions[0].props.onClick({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(opened).toEqual([URL_]);
    expect(answers).toEqual(['done']);
  });
  it('I already reviewed stores done, Not now stores dismissed, neither opens the URL', () => {
    const { actions, answers, opened } = setup();
    actions[1].props.onClick();
    actions[2].props.onClick();
    expect(answers).toEqual(['done', 'dismissed']);
    expect(opened).toEqual([]);
  });
});
