import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { METRIC } from './weather/format';
import { createMockProvider } from './weather/providers/mock';

const provider = createMockProvider({ delayMs: 0 });

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await settle();
}

async function renderApp(hash = '#/') {
  window.location.hash = hash;
  render(<App provider={provider} />);
  await settle();
}

const h1 = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';

describe('Nimbus app with sample data', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('nimbus.units', JSON.stringify({ ...METRIC, clock: '12h' }));
  });
  afterEach(() => {
    window.location.hash = '';
  });

  it('opens Today for the first city', async () => {
    await renderApp();
    expect(h1()).toContain('San Francisco');
    const hero = screen.getByRole('region', { name: 'Current conditions' });
    expect(within(hero).getByText('Clear')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Hourly details/ }).getAttribute('href')).toBe('#/p/5391959/hourly');
    expect(screen.getByRole('link', { name: /Wind/ }).getAttribute('href')).toBe('#/p/5391959/metric/wind');
  });

  it('moves between cities with the arrows', async () => {
    await renderApp('#/p/2643743');
    expect(h1()).toContain('London');
    expect(screen.getByText('Yellow rain warning')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Next city: Reykjavík' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Previous city: Sydney' })).toBeTruthy();
  });

  it('switches to °F from the header and remembers it', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('radio', { name: '°F' }));
    await settle();
    expect(JSON.parse(window.localStorage.getItem('nimbus.units')!)).toMatchObject({ temp: 'F', wind: 'mph', clock: '12h' });
  });

  it('shows the hourly, day and metric detail pages', async () => {
    await renderApp('#/p/5391959/hourly');
    expect(h1()).toBe('Hourly forecast');
    expect(screen.getByRole('table')).toBeTruthy();

    await go('#/p/5391959/day/2');
    expect(h1()).toMatch(/^Wednesday, Nov 25/);
    expect(screen.getByRole('navigation', { name: 'Choose a day' })).toBeTruthy();

    await go('#/p/5391959/metric/air');
    expect(h1()).toBe('Air quality');
    expect(screen.getByText('What the numbers mean')).toBeTruthy();
  });

  it('manages locations: filter, reorder and remove with undo', async () => {
    await renderApp('#/locations');
    expect(h1()).toBe('Locations');
    fireEvent.change(screen.getByLabelText('Search or add a city'), { target: { value: 'tok' } });
    const list = screen.getByRole('list', { name: 'Saved cities' });
    expect(within(list).getAllByRole('link')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('Search or add a city'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Tokyo up' }));
    let saved = JSON.parse(window.localStorage.getItem('nimbus.places')!);
    expect(saved[0].name).toBe('Tokyo');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sydney' }));
    saved = JSON.parse(window.localStorage.getItem('nimbus.places')!);
    expect(saved.map((p: { name: string }) => p.name)).not.toContain('Sydney');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    saved = JSON.parse(window.localStorage.getItem('nimbus.places')!);
    expect(saved.map((p: { name: string }) => p.name)).toContain('Sydney');
  });

  it('changes units in Settings', async () => {
    await renderApp('#/settings');
    fireEvent.click(screen.getByRole('radio', { name: 'm/s' }));
    fireEvent.click(screen.getByRole('radio', { name: '24-hour' }));
    await settle();
    expect(JSON.parse(window.localStorage.getItem('nimbus.units')!)).toMatchObject({ wind: 'ms', clock: '24h' });
  });

  it('shows a friendly page for unknown addresses', async () => {
    await renderApp('#/nowhere');
    expect(h1()).toBe('Page not found');
  });
});
