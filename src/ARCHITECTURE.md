# Architecture Guide

This project uses a feature-first architecture designed for scale.

## Folder Structure

- `app/`: Expo Router screens and route layouts only.
- `src/features/*/ui`: Screen-level and feature UI components.
- `src/features/*/state`: State containers (Zustand) and UI-facing actions.
- `src/features/*/data`: Repositories and local/remote data sources.
- `src/features/*/sync`: Offline queue processing and conflict handling.
- `src/services/*`: Shared infrastructure (API, storage, network, logging).
- `src/shared/*`: Cross-feature reusable UI/hooks/utils/constants.
- `src/config/*`: Environment and app configuration.

## Data Flow

1. UI calls a state action.
2. State computes next in-memory state and delegates persistence to repository.
3. Repository writes durable data to local storage (SQLite).
4. Repository enqueues operation for sync.
5. Sync module pushes queued operations to API when online.

See cart implementation for reference:
- `src/features/cart/state/cartStore.ts`
- `src/features/cart/data/cartRepository.ts`
- `src/features/cart/sync/cartSync.ts`
- `src/features/cart/data/cartLocalDataSource.ts`
