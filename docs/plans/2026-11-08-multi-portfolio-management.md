# Multi-Portfolio Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create up to 10 custom strategy portfolios/folders, group held stocks into them, and view independent PnL, allocation donut charts, and filtered holdings per portfolio tab on `PortfolioPage.jsx`.

**Architecture:** Lightweight Strategy Grouping approach. A new `CustomPortfolio` entity and `custom_portfolio_stocks` mapping table store user portfolio definitions without disrupting the authoritative `portfolios` table or the order matching engine. A dedicated Spring Boot service dynamically computes portfolio metrics from live holdings, and React frontend provides horizontal tab navigation, modals, and charts.

**Tech Stack:** Java 17, Spring Boot 3, Spring Data JPA, Hibernate, MySQL, React 18, Vite, Chart.js / react-chartjs-2, Axios.

---

### Task 1: Backend Data Model & Repository
**Files:**
- Create: `stocklab-backend/src/main/java/com/stocklab/model/CustomPortfolio.java`
- Create: `stocklab-backend/src/main/java/com/stocklab/repository/CustomPortfolioRepository.java`

**Step 1: Write `CustomPortfolio.java`**
- Map table `custom_portfolios` with unique constraint `(user_id, name)`.
- `@ManyToOne User user` (lazy).
- `@ManyToMany Set<Stock> stocks` joined via `custom_portfolio_stocks`.
- `name` (VARCHAR 50), `description` (VARCHAR 255).
- `createdAt`, `updatedAt` timestamps.

**Step 2: Write `CustomPortfolioRepository.java`**
- `List<CustomPortfolio> findByUserIdOrderByCreatedAtAsc(Long userId)`
- `Optional<CustomPortfolio> findByIdAndUserId(Long id, Long userId)`
- `boolean existsByUserIdAndName(Long userId, String name)`
- `long countByUserId(Long userId)`

---

### Task 2: Backend DTOs & Validation
**Files:**
- Create: `stocklab-backend/src/main/java/com/stocklab/dto/portfolio/CustomPortfolioDTO.java`
- Create: `stocklab-backend/src/main/java/com/stocklab/dto/portfolio/CreateCustomPortfolioRequest.java`
- Create: `stocklab-backend/src/main/java/com/stocklab/dto/portfolio/UpdateCustomPortfolioRequest.java`
- Create: `stocklab-backend/src/main/java/com/stocklab/dto/portfolio/UpdatePortfolioStocksRequest.java`
- Create: `stocklab-backend/src/main/java/com/stocklab/dto/portfolio/CustomPortfolioSummaryResponse.java`

**Step 1: Define DTO classes**
- `CustomPortfolioDTO`: id, name, description, stockCount, tickers (List<String>), createdAt.
- `CreateCustomPortfolioRequest`: name (NotBlank, 2-50 chars), description (optional), tickers (List<String> optional).
- `UpdateCustomPortfolioRequest`: name (NotBlank, 2-50 chars), description (optional).
- `UpdatePortfolioStocksRequest`: tickers (List<String> not null).
- `CustomPortfolioSummaryResponse`: id, name, description, totalStockValue, totalInvested, totalPnL, totalPnLPercent, holdings (List<PortfolioResponse>), allocations (List<AllocationItem>).

---

### Task 3: Backend Service Layer
**Files:**
- Create: `stocklab-backend/src/main/java/com/stocklab/service/CustomPortfolioService.java`

**Step 1: Implement methods**
- `getCustomPortfolios(String username)`: fetch all custom portfolios for user, convert to DTOs.
- `createCustomPortfolio(String username, CreateCustomPortfolioRequest req)`:
  - Check max 10 portfolios limit (`countByUserId >= 10` -> error).
  - Check unique name (`existsByUserIdAndName` -> error).
  - Resolve tickers to `Stock` entities from `StockRepository`.
  - Save and return DTO.
- `updateCustomPortfolio(String username, Long portfolioId, UpdateCustomPortfolioRequest req)`:
  - Find portfolio belonging to user.
  - Check duplicate name if name changed.
  - Update and save.
- `deleteCustomPortfolio(String username, Long portfolioId)`:
  - Find portfolio belonging to user, delete it.
- `updatePortfolioStocks(String username, Long portfolioId, UpdatePortfolioStocksRequest req)`:
  - Find portfolio, resolve stocks from tickers, set `stocks`, save.
- `getCustomPortfolioSummary(String username, Long portfolioId)`:
  - Find user and portfolio.
  - Fetch user's active holdings from `portfolioRepository.findByUserId(userId)`.
  - Filter holdings to only stocks present in `customPortfolio.getStocks()`.
  - Calculate `totalStockValue`, `totalInvested`, `totalPnL`, `totalPnLPercent`, donut `allocations` list, and `holdings` mapped to `PortfolioResponse`.

---

### Task 4: Backend REST Controller
**Files:**
- Create: `stocklab-backend/src/main/java/com/stocklab/controller/CustomPortfolioController.java`

**Step 1: Define REST endpoints at `/api/custom-portfolios`**
- `GET ""` -> `getCustomPortfolios`
- `POST ""` -> `createCustomPortfolio`
- `PUT "/{id}"` -> `updateCustomPortfolio`
- `DELETE "/{id}"` -> `deleteCustomPortfolio`
- `PUT "/{id}/stocks"` -> `updatePortfolioStocks`
- `GET "/{id}/summary"` -> `getCustomPortfolioSummary`
- All endpoints authenticate using `Authentication` or `@AuthenticationPrincipal UserDetails`.

---

### Task 5: Backend Build & Verification
**Step 1: Compile backend**
- Run `mvn compile` in `stocklab-backend`.
- Verify zero syntax or type errors.

---

### Task 6: Frontend API Service
**Files:**
- Modify: `stocklab-frontend/src/api/api.js`

**Step 1: Add `customPortfolioAPI` methods**
```javascript
export const customPortfolioAPI = {
  getAll: () => api.get('/custom-portfolios'),
  create: (data) => api.post('/custom-portfolios', data),
  update: (id, data) => api.put(`/custom-portfolios/${id}`, data),
  delete: (id) => api.delete(`/custom-portfolios/${id}`),
  updateStocks: (id, data) => api.put(`/custom-portfolios/${id}/stocks`, data),
  getSummary: (id) => api.get(`/custom-portfolios/${id}/summary`),
};
```

---

### Task 7: Frontend UI Implementation
**Files:**
- Modify: `stocklab-frontend/src/pages/PortfolioPage.jsx`
- Modify: `stocklab-frontend/src/pages/PortfolioPage.css`

**Step 1: State management**
- `customPortfolios`: list of user's custom portfolios.
- `activeTab`: `'all'` or `portfolioId`.
- `activeCustomSummary`: summary data when viewing a custom portfolio.
- Modals state: `showCreateModal`, `showEditModal`, `showManageStocksModal`, `showDeleteModal`.

**Step 2: Tab Bar Component**
- Tab 0: `💼 Tất cả tài sản`
- Custom tabs: Tab button with name + stock count + ⚙️ dropdown menu.
- Action button: `+ Tạo danh mục` (disabled if customPortfolios.length >= 10).

**Step 3: Views & Charts Adaptation**
- If `activeTab === 'all'`: use existing global stats and donut chart.
- If `activeTab === customPortfolioId`: use `activeCustomSummary` data for 4 stats cards, Donut chart, and holdings table.
- Empty state: display empty alert and "+ Thêm mã vào danh mục" if portfolio has no holdings.

**Step 4: Interactive Modals**
- Create/Edit Modal: Form with name, description, and list of checkboxes for user's owned stocks.
- Delete Confirmation Modal.

---

### Task 8: End-to-End Verification
**Step 1: Verify via browser and live servers**
- Test creating a new portfolio (e.g., "Đầu tư dài hạn" with FPT, VNM).
- Check tabs switching, stats recalculation, donut chart rendering.
- Test editing portfolio name and adding/removing stocks.
- Test deleting portfolio and automatic redirect to default tab.
- Test edge case of empty portfolio.
