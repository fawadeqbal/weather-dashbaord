import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createMockProvider } from './weather/providers/mock';

const provider = createMockProvider({ delayMs: 0 });

async function renderApp() {
  render(<App provider={provider} />);
  // Let the mock provider resolve.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

describe('App with sample data', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // The test browser reports en-US, which would default to °F.
    window.localStorage.setItem('nimbus.unit', '"C"');
  });

  it('shows the selected city with its forecast', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('San Francisco');
    const hero = screen.getByRole('region', { name: 'Current conditions' });
    expect(within(hero).getByText('18°')).toBeTruthy();
    expect(within(hero).getByText('Clear')).toBeTruthy();
    expect(screen.getByRole('region', { name: '7-day forecast' })).toBeTruthy();
  });

  it('switches city and unit', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /London/ }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('London');
    expect(screen.getByText('Yellow rain warning')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '°F' }));
    const hero = screen.getByRole('region', { name: 'Current conditions' });
    expect(within(hero).getByText('46°')).toBeTruthy();
    expect(window.localStorage.getItem('nimbus.unit')).toBe('"F"');
  });

  it('filters saved cities from the search box', async () => {
    await renderApp();
    fireEvent.change(screen.getByLabelText('Search or add a city'), { target: { value: 'tok' } });
    const list = screen.getByRole('complementary', { name: 'My cities' });
    expect(within(list).getByRole('button', { name: /Tokyo/ })).toBeTruthy();
    expect(within(list).queryByRole('button', { name: /Sydney/ })).toBeNull();
  });
});
