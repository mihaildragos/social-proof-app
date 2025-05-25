# VPC Network configuration for Social Proof App

# Main VPC network
resource "google_compute_network" "vpc_network" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"
  description            = "VPC network for Social Proof App"
}

# Subnet for GKE cluster
resource "google_compute_subnetwork" "subnet" {
  name                     = "${var.cluster_name}-subnet"
  ip_cidr_range           = "10.0.0.0/24"
  region                  = var.region
  network                 = google_compute_network.vpc_network.id
  private_ip_google_access = true
  description             = "Subnet for GKE cluster and associated resources"

  # Secondary IP ranges for GKE
  secondary_ip_range {
    range_name    = "pod-range"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "service-range"
    ip_cidr_range = "10.2.0.0/16"
  }

  # Log configuration
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Cloud Router for NAT
resource "google_compute_router" "router" {
  name    = "${var.cluster_name}-router"
  region  = var.region
  network = google_compute_network.vpc_network.id
}

# Cloud NAT for outbound internet access
resource "google_compute_router_nat" "nat" {
  name                               = "${var.cluster_name}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall rules

# Allow internal communication within VPC
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.cluster_name}-allow-internal"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
  target_tags   = ["gke-node"]
}

# Allow SSH access
resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.cluster_name}-allow-ssh"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["gke-node"]
}

# Allow HTTP and HTTPS traffic
resource "google_compute_firewall" "allow_http_https" {
  name    = "${var.cluster_name}-allow-http-https"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server", "https-server"]
}

# Allow Load Balancer health checks
resource "google_compute_firewall" "allow_lb_health_checks" {
  name    = "${var.cluster_name}-allow-lb-health-checks"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
  }

  source_ranges = [
    "130.211.0.0/22",  # Google Load Balancer health check ranges
    "35.191.0.0/16",   # Google Load Balancer health check ranges
  ]

  target_tags = ["gke-node"]
}

# Allow NodePort services
resource "google_compute_firewall" "allow_nodeport" {
  name    = "${var.cluster_name}-allow-nodeport"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = ["30000-32767"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["gke-node"]
}

# Firewall rule for specific application ports
resource "google_compute_firewall" "allow_app_ports" {
  name    = "${var.cluster_name}-allow-app-ports"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = [
      "3000",  # Next.js frontend
      "3001",  # Integrations service
      "3002",  # Notification stream service
      "3003",  # Notifications service
      "3004",  # Users service
      "3005",  # Analytics service
      "3006",  # Billing service
      "4000",  # External service mocks
      "5432",  # PostgreSQL
      "6379",  # Redis
      "8123",  # ClickHouse HTTP
      "9000",  # ClickHouse native
      "9092",  # Kafka
    ]
  }

  source_ranges = ["10.0.0.0/8"]
  target_tags   = ["gke-node"]
} 