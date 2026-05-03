package com.stocklab.dto.ws;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import com.stocklab.dto.PortfolioResponse;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
public class PortfolioWsDTO extends BaseWsDTO {
    private List<PortfolioResponse> portfolios;

    public PortfolioWsDTO(List<PortfolioResponse> portfolios) {
        super("PORTFOLIO_UPDATE");
        this.portfolios = portfolios;
    }
}
