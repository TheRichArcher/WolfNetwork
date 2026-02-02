import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CrisisSelector from '@/components/CrisisSelector';

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: jest.fn(),
  writable: true,
});

describe('CrisisSelector', () => {
  const mockOnActivate = jest.fn();

  beforeEach(() => {
    mockOnActivate.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders all four crisis categories', () => {
    render(
      <CrisisSelector
        onActivate={mockOnActivate}
        isActivating={false}
        isConnected={false}
      />
    );

    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(screen.getByText('Medical')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('shows inactive button when no category selected', () => {
    render(
      <CrisisSelector
        onActivate={mockOnActivate}
        isActivating={false}
        isConnected={false}
      />
    );

    const button = screen.getByRole('button', { name: /select/i });
    expect(button).toBeDisabled();
  });

  it('enables button after selecting a category', () => {
    render(
      <CrisisSelector
        onActivate={mockOnActivate}
        isActivating={false}
        isConnected={false}
      />
    );

    fireEvent.click(screen.getByText('Legal'));
    
    const holdButton = screen.getByRole('button', { name: /hold/i });
    expect(holdButton).not.toBeDisabled();
  });

  it('calls onActivate after long press completes', async () => {
    render(
      <CrisisSelector
        onActivate={mockOnActivate}
        isActivating={false}
        isConnected={false}
      />
    );

    // Select category
    fireEvent.click(screen.getByText('Security'));
    
    // Start press
    const holdButton = screen.getByRole('button', { name: /hold/i });
    fireEvent.pointerDown(holdButton);
    
    // Wait for long press timer (1500ms)
    jest.advanceTimersByTime(1500);
    
    expect(mockOnActivate).toHaveBeenCalledWith('security');
  });

  it('does not activate if press is released early', () => {
    render(
      <CrisisSelector
        onActivate={mockOnActivate}
        isActivating={false}
        isConnected={false}
      />
    );

    fireEvent.click(screen.getByText('Medical'));
    
    const holdButton = screen.getByRole('button', { name: /hold/i });
    fireEvent.pointerDown(holdButton);
    
    // Release before timer completes
    jest.advanceTimersByTime(500);
    fireEvent.pointerUp(holdButton);
    
    jest.advanceTimersByTime(2000);
    
    expect(mockOnActivate).not.toHaveBeenCalled();
  });

  it('shows connected state', () => {
    render(
      <CrisisSelector
        onActivate={mockOnActivate}
        isActivating={false}
        isConnected={true}
      />
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Your operator is on the line')).toBeInTheDocument();
  });

  it('shows connecting state', () => {
    render(
      <CrisisSelector
        onActivate={mockOnActivate}
        isActivating={true}
        isConnected={false}
      />
    );

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('prevents interaction when disabled', () => {
    render(
      <CrisisSelector
        onActivate={mockOnActivate}
        isActivating={false}
        isConnected={false}
        disabled={true}
      />
    );

    const legalButton = screen.getByText('Legal').closest('button');
    expect(legalButton).toBeDisabled();
  });
});
