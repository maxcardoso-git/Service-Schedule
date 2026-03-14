# Service-schedule — AI Scheduling Platform

## What This Is

Plataforma de gestão de agenda e agendamentos inteligentes, projetada para ser operada primariamente por agentes de IA. Fornece um motor de agenda (Scheduling Engine) com APIs especializadas que substituem os mocks TRANSFORM das capabilities do OrchestratorAI, permitindo que agentes de IA executem operações reais de agendamento — identificar clientes, consultar histórico, listar serviços, consultar horários, criar pré-reservas, gerar pagamento e confirmar agendamentos.

## Core Value

**Permitir que agentes de IA realizem todas as operações de agenda de forma autônoma, com rastreabilidade conversacional e interface administrativa para operação humana.**

## Current Milestone: v2.0 Frontend

**Goal:** Adicionar interfaces web para administradores e recepcionistas — dashboard administrativo completo com visão de calendário, gestão visual de serviços/profissionais/clientes, e interface simplificada para recepcionistas agilizarem agendamentos presenciais.

**Target features:**
- Dashboard administrativo (calendar view, booking management, CRUD visual)
- Interface recepcionista (agenda do dia, agendamento rápido, busca de cliente)
- Autenticação frontend com roles (admin vs recepcionista)

## Previous Milestones

### v1.0 — AI Scheduling API (Shipped 2026-03-13)
- 5 domain modules, 8 capability-mapped endpoints, 28 requirements
- See .planning/MILESTONES.md

## Context

### Motivação

O OrchestratorAI já possui jornadas de atendimento (Beauty Services) com 8 capabilities que hoje usam mocks TRANSFORM. Esta aplicação fornece as APIs reais para essas capabilities, transformando o agente de IA de simulação em operação real.

### Relação com OrchestratorAI

- OrchestratorAI é o consumidor principal (via capabilities)
- As 8 APIs mapeiam diretamente para capabilities existentes
- Proxy pattern: OrchestratorAI chama esta aplicação via HTTP
- Independente: pode ser consumida por outros agentes/sistemas

### Componentes Principais (5 domínios)

1. **Identity & Clients** — Gestão de clientes (cadastro, busca por telefone, histórico)
2. **Services Catalog** — Catálogo de serviços disponíveis (nome, duração, preço, profissionais)
3. **Scheduling Engine** — Motor de agenda (slots, pré-reservas, confirmações, calendário)
4. **Payment Engine** — Geração de pagamento (PIX, status tracking)
5. **Conversation Tracking** — Rastreabilidade de qual conversa gerou cada agendamento

### APIs Requeridas (mapeamento capabilities)

| Capability OrchestratorAI | Endpoint API | Domínio |
|---|---|---|
| `buscar_cliente_por_telefone` | `GET /api/clients/by-phone/:phone` | Identity & Clients |
| `cadastrar_cliente` | `POST /api/clients` | Identity & Clients |
| `buscar_atendimentos_cliente` | `GET /api/clients/:id/appointments` | Identity & Clients |
| `listar_servicos_disponiveis` | `GET /api/services` | Services Catalog |
| `consultar_slots_agenda` | `GET /api/schedule/slots` | Scheduling Engine |
| `gerar_pre_reserva` | `POST /api/bookings/pre-reserve` | Scheduling Engine |
| `gerar_pagamento_pix` | `POST /api/payments/pix` | Payment Engine |
| `confirmar_agendamento` | `POST /api/bookings/:id/confirm` | Scheduling Engine |

### Usuários do Sistema

| Papel | Descrição |
|-------|-----------|
| **Agente de IA** | Consome APIs automaticamente (principal usuário) |
| **Recepcionista** | Visualiza agenda e edita agendamentos |
| **Administrador** | Configura serviços, horários, profissionais e usuários |
| **Gestor** | Acompanha agenda e métricas |

## Requirements

### Validated

- ✓ Buscar cliente por telefone — v1.0
- ✓ Cadastrar novo cliente — v1.0
- ✓ Consultar histórico de atendimentos — v1.0
- ✓ Listar serviços disponíveis — v1.0
- ✓ CRUD de serviços (admin API) — v1.0
- ✓ Associar profissionais a serviços — v1.0
- ✓ Consultar slots disponíveis — v1.0
- ✓ Criar pré-reserva temporária (TTL) — v1.0
- ✓ Confirmar agendamento — v1.0
- ✓ Cancelar agendamento — v1.0
- ✓ Gestão de horários de trabalho — v1.0
- ✓ Gerar pagamento PIX (simulado) — v1.0
- ✓ Consultar status do pagamento — v1.0
- ✓ Simular pagamento (dev) — v1.0
- ✓ Registrar conversationId — v1.0
- ✓ Consultar por conversationId — v1.0
- ✓ API Key auth para agentes — v1.0
- ✓ JWT admin auth — v1.0
- ✓ Swagger/OpenAPI docs — v1.0

### Active

**v2.0 Frontend**

- [ ] Interface administrativa web (dashboard, calendar, CRUD visual)
- [ ] Interface recepcionista (agenda simplificada, agendamento rápido)
- [ ] Autenticação frontend (login, sessão, roles)

### Out of Scope

- Processamento real de pagamento PIX — simulação com status tracking apenas
- Multi-tenant — single tenant (um salão/empresa) na v1
- Notificações push/SMS — sem envio de notificações na v1
- Integração calendário externo (Google Calendar sync) — calendário próprio apenas
- Mobile app — web only na v1

## Constraints

- **Backend-first**: Prioridade nas 8 APIs para desbloquear capabilities do OrchestratorAI
- **Mesmo ecossistema**: Node.js + Express + Prisma + PostgreSQL (mesma stack do OrchestratorAI)
- **Deploy no mesmo servidor**: VPS 72.61.52.70 (junto com OrchestratorAI)
- **API Key auth**: Agentes autenticam via API Key no header
- **Stateless**: APIs REST stateless, estado mantido no banco

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Node.js + Express + Prisma | Mesmo ecossistema do OrchestratorAI, familiaridade do time | — Pending |
| PostgreSQL compartilhado | Reduz infra, mesmo servidor já tem PostgreSQL | — Pending |
| API-first (sem frontend no MVP) | Desbloquear capabilities é prioridade #1 | — Pending |
| Pré-reserva com TTL | Evitar double-booking enquanto agente coleta pagamento | — Pending |
| PIX simulado | Foco na API shape, integração real de pagamento vem depois | — Pending |

---
*Last updated: 2026-03-13 after starting v2.0 Frontend milestone*
