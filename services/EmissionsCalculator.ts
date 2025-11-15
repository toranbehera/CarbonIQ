/**
 * Emissions Calculator - Stateless OBD → CO₂ Module
 * Calculates CO₂ emissions from OBD data for gasoline vehicles
 */

// Constants for gasoline
const AFR_STOICH = 14.7; // Air-fuel ratio at stoichiometric
const FUEL_DENSITY_G_PER_L = 745; // grams per liter
const EF_CO2_G_PER_L = 2340; // CO₂ emission factor: grams per liter of fuel

interface EmissionsInputs {
  dt_s: number; // elapsed seconds since last tick
  speed_mps: number; // m/s from OBD PID 0x0D
  maf_gps?: number; // MAF in g/s from PID 0x10 (preferred)
  fuel_rate_Lh?: number; // Fuel rate in L/h from PID 0x5E
  lambda_equiv?: number; // equivalence ratio λ (default 1.0)
}

interface EmissionsOutputs {
  co2_gps: number; // CO₂ grams per second
  co2_g_per_km_instant: number | null; // instantaneous intensity
  total_co2_g: number; // cumulative grams since reset
  distance_km: number; // cumulative distance since reset
  avg_co2_g_per_km: number | null; // total/distance
  flags: {
    used_maf: boolean;
    used_fuel_rate: boolean;
    stale: boolean;
  };
}

interface EmissionsSummary {
  total_co2_g: number;
  distance_km: number;
  avg_co2_g_per_km: number | null;
}

class EmissionsCalculator {
  private total_co2_g = 0;
  private distance_km = 0;

  /**
   * Reset all accumulated totals
   */
  reset(): void {
    this.total_co2_g = 0;
    this.distance_km = 0;
  }

  /**
   * Calculate fuel volume flow (L/s)
   * Uses MAF if available, otherwise fuel_rate, otherwise marks stale
   */
  private calculateFuelFlow(inputs: EmissionsInputs): {
    fuel_vol_flow_Lps: number;
    used_maf: boolean;
    used_fuel_rate: boolean;
    stale: boolean;
  } {
    // Path A: Use MAF if available
    if (inputs.maf_gps !== undefined && inputs.maf_gps > 0) {
      const lambda_eff = Math.max(0.8, inputs.lambda_equiv || 1.0);
      const fuel_mass_flow_gps = inputs.maf_gps / (AFR_STOICH * lambda_eff);
      const fuel_vol_flow_Lps = fuel_mass_flow_gps / FUEL_DENSITY_G_PER_L;
      return { fuel_vol_flow_Lps, used_maf: true, used_fuel_rate: false, stale: false };
    }

    // Path B: Use fuel rate if available
    if (inputs.fuel_rate_Lh !== undefined && inputs.fuel_rate_Lh > 0) {
      const fuel_vol_flow_Lps = inputs.fuel_rate_Lh / 3600.0;
      return { fuel_vol_flow_Lps, used_maf: false, used_fuel_rate: true, stale: false };
    }

    // No valid inputs available
    return { fuel_vol_flow_Lps: 0, used_maf: false, used_fuel_rate: false, stale: true };
  }

  /**
   * Process one tick of OBD data
   * Returns emissions calculations and updates internal state
   */
  ingestTick(inputs: EmissionsInputs): EmissionsOutputs {
    // Guardrails: reject negatives
    if (inputs.dt_s <= 0 || inputs.speed_mps < 0) {
      return this.getLastStableOutputs();
    }

    // Calculate fuel flow
    const { fuel_vol_flow_Lps, used_maf, used_fuel_rate, stale } = this.calculateFuelFlow(inputs);

    // If stale, don't update totals
    if (stale) {
      return this.getLastStableOutputs();
    }

    // Fuel → CO₂ mass flow (g/s)
    const co2_gps = fuel_vol_flow_Lps * EF_CO2_G_PER_L;

    // Instantaneous intensity (g/km)
    const co2_g_per_km_instant = inputs.speed_mps > 0 
      ? (co2_gps / inputs.speed_mps) * 1000.0 
      : null;

    // Accumulation (stateful totals)
    this.total_co2_g += co2_gps * inputs.dt_s;
    const distance_m = inputs.speed_mps * inputs.dt_s;
    this.distance_km += distance_m / 1000.0;

    const avg_co2_g_per_km = this.distance_km > 0 
      ? this.total_co2_g / this.distance_km 
      : null;

    return {
      co2_gps,
      co2_g_per_km_instant,
      total_co2_g: this.total_co2_g,
      distance_km: this.distance_km,
      avg_co2_g_per_km,
      flags: { used_maf, used_fuel_rate, stale },
    };
  }

  /**
   * Get current summary without processing new data
   */
  getSummary(): EmissionsSummary {
    return {
      total_co2_g: this.total_co2_g,
      distance_km: this.distance_km,
      avg_co2_g_per_km: this.distance_km > 0 ? this.total_co2_g / this.distance_km : null,
    };
  }

  /**
   * Get last stable outputs when data is stale
   */
  private getLastStableOutputs(): EmissionsOutputs {
    return {
      co2_gps: 0,
      co2_g_per_km_instant: null,
      total_co2_g: this.total_co2_g,
      distance_km: this.distance_km,
      avg_co2_g_per_km: this.distance_km > 0 ? this.total_co2_g / this.distance_km : null,
      flags: { used_maf: false, used_fuel_rate: false, stale: true },
    };
  }
}

export default new EmissionsCalculator();
export type { EmissionsInputs, EmissionsOutputs, EmissionsSummary };

